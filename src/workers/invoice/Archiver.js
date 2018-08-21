'use strict';
const moment = require('moment');

const dbInit = require('@opuscapita/db-init'); // Database
const Logger = require('ocbesbn-logger');

const elasticContext = require('../../shared/elasticsearch');
const Mapper = require('./Mapper');
const {
    ErrCodes,
    InvoiceArchiveConfig
} = require('../../shared/invoice_archive_config');

class Archiver {

    constructor(eventClient, logger) {

        this.elasticContext = elasticContext;
        this.eventClient = eventClient;

        this.db = null;

        this.logger = logger || new Logger({
            context: {
                serviceName: 'archive'
            }
        });

    }

    async init() {
        try {
            this.db = await dbInit.init(); // FIXME should await on the result
        } catch (e) {
            /* handle error */
            this.logger.error('InvoiceArchiver#init: Failed to initialize.' , e);
        }

        return true;
    }

    /**
     * @method processReindexResult
     *
     * Processes the result of an reindex operation and return
     * an indication of success or failure.
     *
     * @param {object} result
     *
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
            this.logger.error('Failed to create archive. Got invalid result from elasticContext.');
            returnValue = false;
        }

        return returnValue;
    }

    /**
     * @method handleCreateGlobalDaily
     *
     * Handler for msg.type = "daily"
     *
     * Triggers the reindexing from eg.: bn_tx_logs-2018.05.* to archive_global_daily-2018.05.*
     *
     * @returns {Boolean} Indicates job success
     *
     */
    async handleCreateGlobalDaily() {
        let returnValue = false;

        try {
            let result = await this.reindexGlobalDaily();
            returnValue = this.processReindexResult(result);
        } catch (e) {
            // Dismiss event incase the source index does not exist.
            if (e && e.code && ErrCodes.hasOwnProperty(e.code)) {
                returnValue = null;
            }

            this.logger.error('Invoice - Archiver#handleCreateGlobalDaily: Failed to create archive_global_daily index.');
            this.logger.error(e);
        }

        return returnValue;
    }

    /**
     * @method handleUpdateTenantYearly
     *
     * Handler for msg.type = "daily"
     *
     * Triggers the reindexing from eg.: bn_tx_logs-2018.05.*
     * to archive_global_daily-2018.05.*
     *
     * @params {Object} tenantConfig - JSON representation of TenantConfig Sequelize model
     * @returns {Promise}
     *
     */
    async handleUpdateTenantYearly(tenantConfig) {
        let returnValue = false;

        let tenantId = tenantConfig.customerId || tenantConfig.supplierId;

        try {
            let result = await this.reindexTenantMonthlyToYearly(tenantId);
            returnValue = this.processReindexResult(result, tenantConfig);
        } catch (e) {
            // Dismiss event incase the source index does not exist.
            if (e && e.code && ErrCodes.hasOwnProperty(e.code)) {

                if (e.code === ErrCodes.ERR_SRC_INDEX_DOES_NOT_EXIST) {
                    this.logger.error(`Archiver#handleUpdateTenantYearly: Failed to update yearly invoice archive for tenantId ${tenantId}. Source index unavailable.`);

                    returnValue = true;
                } else {
                    this.logger.error('Invoice - Archiver#handleUpdateTenantYearly: Failed to update archive_tenant_yearly index for tenant ' + tenantId);
                    this.logger.error(e);

                    returnValue = null;
                }

            }

        }

        return returnValue;
    }
    /**
     * @method handleUpdateTenantMonthly
     *
     * Handler for msg.type = "daily"
     *
     * Triggers the reindexing from eg.: bn_tx_logs-2018.05.*
     * to archive_global_daily-2018.05.*
     *
     * @params {Object} tenantConfig - JSON representation of TenantConfig Sequelize model
     * @returns {Promise}
     *
     */
    async handleUpdateTenantMonthly(tenantConfig) {
        let returnValue = false;

        let tenantId = tenantConfig.customerId || tenantConfig.supplierId;

        try {
            let query = await this.buildTenantQueryParam(tenantConfig);
            let result = await this.reindexGlobalDailyToTenantMonthly(tenantId, query);

            returnValue = this.processReindexResult(result);
        } catch (e) {
            if (e && e.code && ErrCodes.hasOwnProperty(e.code)) {

                if (e.code === ErrCodes.ERR_SRC_INDEX_DOES_NOT_EXIST) {
                    this.logger.warn(`Archiver#handleUpdateTenantMonthly: Failed to update monthly invoice archive for tenantId ${tenantId}. Source index unavailable.`);

                    returnValue = true;
                } else {
                    this.logger.error('Invoice - Archiver#handleUpdateTenantMonthly: Failed to update archive_tenant_monthly index for tenant ' + tenantId);
                    this.logger.error(e);

                    returnValue = null;
                }
            }

        }

        return returnValue;
    }


    /**
     * @method buildTenantQueryParam
     *
     * Takes a tenantConfig Object and creates an ES query out of it.
     *
     * @params {Object} tenantConfig - JSON representation of TenantConfig Sequelize model
     * @returns {Promise}
     *
     */
    async buildTenantQueryParam({customerId, supplierId}) {
        if (customerId === null && supplierId === null) {
            throw new Error('Invoice Archiver#buildTenantQueryParam: TenantConfig does not contain a supplier or customer ID.');
        }

        let queryParam = {
            term: {}
        };

        if (customerId) {
            queryParam.term['event.customerId.keyword'] = customerId;
        }

        if (supplierId) {
            queryParam.term['event.supplierId.keyword'] = supplierId;
        }

        return queryParam;
    }

    /**
     * @method getPrefixTenantId
     *
     * Takes a tenantConfig object and returns the prefixed tenantId.
     *
     * @param {Object} - TenantConfig
     *
     * @return {String|null}
     *
     */
    getPrefixedTenantId(tenantConfig) {
        if (typeof tenantConfig !== 'object') {
            return null;
        }

        if (!tenantConfig.hasOwnProperty('customerId') && !tenantConfig.hasOwnProperty('supplierId')) {
            return null;
        }

        if (tenantConfig.customerId && typeof tenantConfig.customerId === 'string' && tenantConfig.customerId.length >= 1) {
            return `c_${tenantConfig.customerId}`;
        }

        if (tenantConfig.supplierId && typeof tenantConfig.supplierId === 'string' && tenantConfig.supplierId.length >= 1) {
            return `s_${tenantConfig.supplierId}`;
        }

        return null;
    }

    /**
     * @async
     * @function reindexGlobalDaily
     *
     * Triggers a reindex job on ES to copy all archivable
     * entries from the daily transaction index to the global
     * daily archive index.
     *
     * @returns {Promise<object>} Config object containing the reindex operation details
     */
    async reindexGlobalDaily() {
        let yesterday = moment().subtract(1, 'days');
        let fmtYesterday = moment().subtract(1, 'days').format('YYYY.MM.DD');

        let srcIndex = `bn_tx_logs-${fmtYesterday}`;
        let dstIndex = `${InvoiceArchiveConfig.indexPrefix}global_daily-${fmtYesterday}`;

        let result = {
            srcIndex,
            dstIndex,
            tenantId: null,
            type: {
                scope: 'global',
                period: 'daily'
            },
            date: {
                day: yesterday.format('DD'),
                month: yesterday.format('MM'),
                year: yesterday.format('YYYY')
            },
            reindexResult: null
        };

        result.reindexResult = await this.elasticContext.reindex(srcIndex, dstIndex, null);

        return result;
    }

    /**
     * @function reindexGlobalDailyToTenantMonthly
     *
     * Trigers the reindex operation for a single tenant to extract the
     * entries from yesterday's archive_global_daily to the archive_tenant_monthly
     * index.
     *
     * @param {String} tenantId
     * @param {Object} query
     *
     */
    async reindexGlobalDailyToTenantMonthly(tenantId, query) {
        let yesterday          = moment().subtract(1, 'days');

        let fmtYesterday       = yesterday.format('YYYY.MM.DD');
        let fmtYesterdaysMonth = yesterday.format('YYYY.MM');

        let lowerTenantId = this.elasticContext.normalizeTenantId(tenantId);

        let srcIndexName = `${InvoiceArchiveConfig.indexPrefix}global_daily-${fmtYesterday}`;
        let dstIndexName = `${InvoiceArchiveConfig.indexPrefix}tenant_monthly-${lowerTenantId}-${fmtYesterdaysMonth}`;

        let result = {
            srcIndex: srcIndexName,
            dstIndex: dstIndexName,
            tenantId: tenantId,
            type: {
                scope: 'tenant',
                period: 'monthly'
            },
            date: {
                day: yesterday.format('DD'),
                month: yesterday.format('MM'),
                year: yesterday.format('YYYY')
            },
            reindexResult: null
        };

        result.reindexResult = await this.elasticContext.reindex(srcIndexName, dstIndexName, query);

        try {
            await this.elasticContext.conn.indices.close({index: dstIndexName});
        } catch (e) {
            // Do not throw just because we could not close the index.
            console.error(`Could not close ${dstIndexName}`);
        }

        return result;
    }

    /**
     * @function reindexTenantMonthlyToYearly
     *
     * Trigers the reindex operation for a single tenant's  monthly
     * archive index to the tenant's yearly archive.
     *
     * @param {String} tenantId
     */
    async reindexTenantMonthlyToYearly(tenantId) {
        let yesterday          = moment().subtract(1, 'days');

        let fmtYesterdaysMonth = moment().subtract(1, 'days').format('YYYY.MM');
        let fmtYesterdaysYear  = moment().subtract(1, 'days').format('YYYY');

        let lowerTenantId = this.elasticContext.normalizeTenantId(tenantId);

        let srcIndex = `${InvoiceArchiveConfig.indexPrefix}tenant_monthly-${lowerTenantId}-${fmtYesterdaysMonth}`;
        let dstIndex = `${InvoiceArchiveConfig.indexPrefix}tenant_yearly-${lowerTenantId}-${fmtYesterdaysYear}`;

        let result = {
            srcIndex,
            dstIndex,
            tenantId: null,
            type: {
                scope: 'tenant',
                period: 'yearly'
            },
            date: {
                day: yesterday.format('DD'),
                month: yesterday.format('MM'),
                year: yesterday.format('YYYY')
            },
            reindexResult: null
        };

        result.reindexResult = await this.elasticContext.reindex(srcIndex, dstIndex, null);

        try {
            // await this.conn.indices.close({index: srcIndexName});
            await this.elasticContext.conn.indices.close({index: dstIndex});
        } catch (e) {
            // Do not throw just because we could not close the index.
            console.error(`Could not close ${dstIndex}`);
        }

        return result;
    }

    /**
     * @function archiveTransaction
     *
     * Archives a single transaction identified by the first param.
     *
     * 1. Find all documents belonging to the transaction
     * 2. Map the result set to a new archive entry
     * 3. Detect the owning tenantId
     * 4. Create or open the tenants monthly index
     * 5. Write the entry to the tenant index
     *
     * @param {String} transactionId
     *
     * @return {Boolean} Indicates the success or failure of the operation.
     */
    async archiveTransaction(transactionId) {

        let es = this.elasticContext.client;
        let retVal = false;

        /* Find all documents that belong to the transaction */
        let result = await es.search({
            index: 'bn_tx_logs*',
            body: {
                query: {
                    term: {
                        'event.transactionId.keyword': transactionId
                    }
                },
                sort: {
                    'event.timestamp': {
                        order: 'asc'
                    }
                }
            }
        });

        if (result && result.hits && result.hits.total > 0) {

            /* Extract events from ES result set */
            let hits = result.hits.hits.map((h) => h._source && h._source.event);

            if (hits && hits.length > 0) {
                let mapper = new Mapper(transactionId, hits);

                let tenantId = mapper.owner;

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

                            let archiveName = InvoiceArchiveConfig.monthlyTenantArchiveName(tenantId);

                            try {
                                /* Open existing index or create new with mapping */
                                let indexOpened = await elasticContext.openIndex(archiveName, true, {mapping: elasticContext.esMapping});

                                if (indexOpened) {
                                    let createResult;

                                    try {
                                        createResult = await elasticContext.client.create({
                                            index: archiveName,
                                            id: transactionId,
                                            type: elasticContext.defaultDocType,
                                            body: mappingResult
                                        });

                                        if (createResult) {
                                            retVal = true;
                                        }
                                    } catch (e) {
                                        if (e && e.body && e.body.error && e.body.error.type && e.body.error.type === 'version_conflict_engine_exception') {
                                            this.logger.error(`InvoiceArchiver#archiveTransaction: Transaction has already been written to index  ${archiveName}. (TX id: ${transactionId})`, e);
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

}

module.exports = Archiver;
