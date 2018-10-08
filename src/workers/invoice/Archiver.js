'use strict';

const dbInit = require('@opuscapita/db-init'); // Database
const Logger = require('ocbesbn-logger');

const elasticsearch = require('../../shared/elasticsearch');
const Mapper = require('./Mapper');

const {InvoiceArchiveConfig} = require('../../shared/invoice_archive_config');

class Archiver {

    constructor(eventClient, logger) {

        this.elasticsearch = elasticsearch;
        this.eventClient = eventClient;

        this.db = null;

        this.logger = logger || new Logger({
            context: {
                serviceName: 'archive'
            }
        });

    }

    /**
     * Initializes the database and elasticsearch connection.
     *
     * @async
     * @function init
     */
    async init() {
        try {
            this.db = await dbInit.init();
            await this.elasticsearch.init();
        } catch (e) {
            this.logger.error('InvoiceArchiver#init: Failed to initialize with exception.' , e);
        }

        return true;
    }

    /**
     * Processes the result of an reindex operation and return
     * an indication of success or failure.
     *
     * @method processReindexResult
     * @param {object} result
     * @returns {Boolean} Success indicator
     */
    processReindexResult(result, tenantConfig) {
        let returnValue = false;

        if (result && result.dstIndex && result.reindexResult) {
            if (result.reindexResult.failures && result.reindexResult.failures.length >= 1) {
                this.logger.error(`Failed to create ${result.dstIndex}`);
                returnValue = false;
            } else {
                this.logger.log(`Successfully created ${result.dstIndex}`);
                returnValue = true;

                let payload = tenantConfig ? {result, tenantConfig} : {result};

                this.eventClient.emit(InvoiceArchiveConfig.finishedLogrotationJobQueueName, payload)
                    .catch((e) => this.logger.error(e));
            }
        } else {
            // ES returned null or undefined
            this.logger.error('Failed to create archive. Got invalid result from elasticsearch.');
            returnValue = false;
        }

        return returnValue;
    }

    /**
     * Archives a single transaction identified by the first param.
     *
     * 1. Find all documents belonging to the transaction
     * 2. Map the result set to a new archive entry
     * 3. Detect the owning tenantId
     * 4. Create or open the tenants monthly index
     * 5. Write the entry to the tenant index
     *
     * TODO needs refactoring because to complex and to ugly
     *
     * @async
     * @function archiveTransaction
     * @param {String} transactionId
     * @return {Boolean} Indicates the success or failure of the operation.
     */
    async archiveTransaction(transactionId) {

        let retVal = false;

        /* Find all documents that belong to the transaction */
        let result;
        try {
            result = await this.fetchTransactionDocumentsById(transactionId);
        } catch (e) {
            this.logger.error(`InvoiceArchiver#archiveTransaction: Exception caught while trying to fetch transaction ${transactionId} from elasticsearch`, e);
            return false;
        }

        if (result && result.hits && result.hits.total > 0) {

            /* Extract events from ES result set */
            let hits = result.hits.hits.map((h) => h._source && h._source.event);

            if (hits && hits.length > 0) {
                let mapper = new Mapper(transactionId, hits);
                let tenantId;

                try {
                    tenantId = mapper.owner;
                } catch (e) {
                    this.logger.log(`Archiver#archiveTransaction: Failed to read owner for transaction: ${transactionId}`, e);
                    tenantId = null;
                }

                if (tenantId) {
                    let tenantConfigModel;
                    let tenantConfig;

                    try {
                        if (!this.db) await this.init();

                        /* Check if owning tenantId has valid archive configuration */
                        tenantConfigModel = await this.db.modelManager.getModel('TenantConfig');
                        tenantConfig = await tenantConfigModel.findOne({
                            where: {
                                tenantId: tenantId
                            }
                        });
                    } catch (e) {
                        this.logger.error('InvoiceArchiver#archiveTransaction: Failed to get config from SQL.', e);
                    }

                    if (tenantConfig) {

                        let mappingResult = mapper.do();

                        if (mappingResult) {
                            /* Write archive to monthly ES */

                            let archiveName = InvoiceArchiveConfig.yearlyTenantArchiveName(tenantId, mappingResult.end);

                            try {
                                /* Open existing index or create new with mapping */
                                let indexOpened = await this.elasticsearch.openIndex(archiveName, true, {
                                    mapping: InvoiceArchiveConfig.esMapping
                                });

                                if (indexOpened) {
                                    let createResult;

                                    try {
                                        createResult = await this.elasticsearch.client.create({
                                            index: archiveName,
                                            id: transactionId,
                                            type: this.elasticsearch.defaultDocType,
                                            body: mappingResult
                                        });

                                        if (createResult && createResult.created === true) {
                                            retVal = true;

                                            /** TODO toggle archivable flag on blob references */
                                        }
                                    } catch (e) {
                                        if (e && e.body && e.body.error && e.body.error.type && e.body.error.type === 'version_conflict_engine_exception') {
                                            this.logger.info(`InvoiceArchiver#archiveTransaction: (Version conflict) Transaction has already been written to index  ${archiveName}. (TX id: ${transactionId})`, e);
                                            retVal =  true; // FIXME
                                        } else {
                                            this.logger.error(`InvoiceArchiver#archiveTransaction: Failed to create archive document in ${archiveName}. (TX id: ${transactionId})`, e);
                                            retVal = false;
                                        }
                                    }
                                }
                            } catch (e) {
                                this.logger.error(`InvoiceArchiver#archiveTransaction: Unable to open index ${archiveName}. (TX id: ${transactionId})`, e);
                            }
                        }

                    } else {
                        this.logger.info(`InvoiceArchiver#archiveTransaction: owning tenant ${tenantId} is not configured for archiving. (TX id: ${transactionId})`);
                    }
                } else {
                    this.logger.error(`InvoiceArchiver#archiveTransaction: Unable to extract owning tenantId from transaction ${transactionId}`);
                }
            }
        } else {
            this.logger.error(`InvoiceArchiver#archiveTransaction: No documents found for transaction ${transactionId}`);
        }

        return retVal;
    }

    /**
     * Fetches a list of transaction entries from elasticsearch
     * by the given transactionId
     *
     * @async
     * @function fetchTransactionDocumentsById
     * @param {string} id - transactionId
     */
    async fetchTransactionDocumentsById(id) {
        return this.elasticsearch.client.search({
            index: 'bn_tx_logs*',
            body: {
                query: {
                    bool: {
                        must: {
                            term: {
                                'event.transactionId': id
                            }
                        },
                        filter: {
                            term: {
                                'event.archivable': true
                            }
                        }
                    }
                },
                sort: {
                    'event.timestamp': {
                        order: 'asc'
                    }
                }
            }
        });
    }

}

module.exports = Archiver;
