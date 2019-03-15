'use strict';

const {format, subDays} = require('date-fns');

const dbInit        = require('@opuscapita/db-init'); // Database
const config        = require('@opuscapita/config');
const Logger        = require('ocbesbn-logger');
const ServiceClient = require('ocbesbn-service-client');

const elasticsearch = require('../../shared/elasticsearch/elasticsearch');
// const helpers       = require('../../shared/helpers');
const ArchiveConfig = require('../../shared/ArchiveConfig');
const GenericMapper = require('./GenericMapper');

class GenericArchiver {

    constructor(eventClient, logger = null) {
        this.serviceClient = new ServiceClient();

        this.elasticsearch = elasticsearch;
        this.eventClient   = eventClient;

        this.db = null;

        this._logger       = logger;
        this._tntLogPrefix = 'bn_tx_logs-';
        this._tntOffset    = 60; // Number of days to go back in TnT history for fetching logs
    }

    /** *** GETTER *** */

    get klassName() {
        return this.constructor.name || 'GenericArchiver';
    }

    get logger() {
        if (!this._logger) {
            this._logger = new Logger({
                context: {
                    serviceName: 'archive'
                }
            });
        }

        return this._logger;
    }

    /** *** PUBLIC *** */

    /**
     * Initializes the database and elasticsearch connection.
     *
     * @async
     * @function init
     * @return {boolean=true}
     */
    async init() {
        try {
            await config.init({});
            await this.elasticsearch.init();
            this.db = await dbInit.init();
        } catch (e) {
            this.logger.error(this.klassName, '#init: Failed to initialize with exception.' , e);
        }

        return true;
    }

    /**
     * Run all transactions from a single day for the given tenant from
     * TnT log to the archive.
     *
     * 1. Log start of processing
     *     1.1. Check that job has not already run
     * 2. Find all transactionIds on that day where tenantId is receiver or sender
     * 3. Iterate result from 1. and fetch all events for a single transaction
     * 4. Filter result from 2. based on:
     *     - Log access
     *     - archivable
     * 5. Transform result from 3. into archive entry.
     * 6. Log end of processing
     *
     * @todo Check TenantConfig for archive type to differentiate A2A and BNP tenants.
     * @todo See TnT archive for how aggregation of transcations into one entry is done. Maybe this could be used instead of Archiver class.
     *
     * @async
     * @function updateDailyArchive
     * @param {string} tenantId
     * @param {date} date - The day that should be archived
     * @returns {boolean} Success indicator
     */
    async doDailyArchiving(tenantId, date = Date.now()) {
        const lookback = await config.getProperty('config/archiver/generic/lookback');
        const day = format(subDays(date, lookback), 'YYYY.MM.DD');

        let success = false;

        this.logger.info(this.klassName, '#doDailyArchiving: Starting daily archiving for tenantId ', tenantId, 'on day ', day);

        try {
            const transactionIds   = await this.getUniqueTransactionIdsByDayAndTenantId(tenantId, day); // Fetch all IDs of finished transactions for the given day
            const archiveDocs      = await this.mapTransactionsToArchiveDocument(tenantId, transactionIds); // Create archive documents for every identified transaction from the step before
            const insertResult     = await this.insertArchiveDocuments(tenantId, day, archiveDocs); // Create documents on Elasticsearch
            const updateBlobResult = await this.processAttachments(insertResult.done);

            const hasFailedTransactions = insertResult.failed.length > 0 || updateBlobResult.failed.length > 0;

            if (hasFailedTransactions)
                this.logger.info(`${this.klassName}#doDailyArchiving: Finished with errors.`, hasFailedTransactions); // TODO persist failures.
            else
                this.logger.info(`${this.klassName}#doDailyArchiving: Finished successful`);

            success = true;
        } catch (e) {
            this.logger.error(this.klassName, '#doDailyArchiving: Failed to run daily archiving for tenantId ', tenantId, ' with exception.', e);
            success = false;
        }

        return success;
    }

    /**
     * Map a list of events to a single archive entry.
     *
     * @function eventsToArchive
     * @param {string} tenantId
     * @param {string} transactionId
     * @param {array} events - List of TnT events
     * @return {object} Archive entry aggregated from all incomingn events.
     */
    eventsToArchive(tenantId, transactionId, events) {
        let result;
        const mapper = new GenericMapper(tenantId, transactionId, events);

        result = mapper.do();

        return result;
    }

    /**
     * Filters a list of events by the given tenant and the log  access of individual events.
     *
     * @function filterEventsByTenantAndAccessLevel
     * @param {array} events - List of events that should be filtered.
     * @return {array} List of filtered events.
     */
    filterEventsByTenantAndAccessLevel(tenantId, events) {
        let result = [];

        for (const event of events) {
            const isSender = event && event.sender && event.sender.originator && event.sender.originator === tenantId;
            const isReceiver = event && event.receiver && event.receiver.target && event.receiver.target === tenantId;

            if (isSender && isReceiver) {
                this.logger.warn(this.klassName, '#filterEventsByTenantAndAccessLevel: Found event with sender and receiver being the same tenant.', tenantId);
            }

            if (!isSender && !isReceiver) {
                continue; // Stop event processing, no receiver or sender found.
            }

            /** Check logAccess next. */
            const logAccess         = event.logAccess.trim().toLowerCase();
            const hasSenderAccess   = isSender && ['sender', 'both'].includes(logAccess);
            const hasReceiverAccess = isReceiver && ['receiver', 'both'].includes(logAccess);

            if (hasReceiverAccess || hasSenderAccess) {
                result.push(event);
            }
        }

        return result;
    }

    /**
     * Fetching all events for a distinct transactionId with log access set
     * to sender, receiver or both.
     *
     * @param {string} transactionId
     * @param {string} tenantId
     * @returns {Promise}
     * @fulfil All events belonging to a transaction
     * @reject {Eroro}
     */
    async getEventsByTransactionId(transactionId, tenantId) {
        const index = `${this._tntLogPrefix}*`;
        const query = {
            index,
            body: {
                query: this._addTenantIdClause({
                    bool: {
                        filter: {
                            bool: {
                                should: [],
                                must: [
                                    {term: {'event.transactionId': transactionId}},
                                    {terms: {'event.logAccess': ['Sender', 'Receiver', 'Both']}}
                                ]
                            }
                        }
                    }
                }, tenantId),
                sort: {
                    'event.timestamp': {
                        order: 'asc'
                    }
                },
                size: 1000 // Use count before to get actual number of documents. TODO raise if max shard count is exceeded.
            }
        };

        let events = await this.elasticsearch.search(query);
        events = events.hits.hits.map(hit => hit._source.event);

        return events;
    }


    /**
     * Fetch a list of transacation ids by the given tenantId and the day.
     *
     * @function getTransactionIdsByDayAndTenantId
     * @param {string} tenantId
     * @param {string} day
     * @return {Promise}
     * @fulfil {Array} List of transaction for the given  tenannt on the given day
     * @reject {Error} Elasticsearch errors, eg. Index not found
     */
    async getUniqueTransactionIdsByDayAndTenantId(tenantId, day) {
        let result = [];
        const index = `${this._tntLogPrefix}${day}`;

        let q = {
            bool: {
                filter: {
                    bool: {
                        should: [],
                        must: [
                            {match: {'event.processingFinished': true}}
                        ]
                    }
                }
            }
        };

        q = this._addTenantIdClause(q, tenantId);

        /** Fetch overall document count matching the query. */
        const {count} = await this.elasticsearch.count({
            index,
            body: {
                query: q
            }
        });

        this.logger.log(`${this.klassName}#getUniqueTransactionIdsByDayAndTenantId: Found ${count} finished transactions.`);

        if (count) {
            const aggregationQuery = {
                size: 0,
                _source: ['event.transactionId'],
                query: q,
                sort: {
                    'event.timestamp': {
                        order: 'asc'
                    }
                },
                aggs: {
                    uniq: {
                        terms: {
                            field: 'event.transactionId',
                            /**
                             * Set upper limit to number of total documents.
                             * FIXME Reconsider how to iterate transactions for customers with +1000 transactions/day
                             */
                            size: count
                        }
                    }
                }
            };

            /** Fetch unique transactions IDs by tenantId and date. */
            const aggregationResult = await this.elasticsearch.search({
                index,
                body: aggregationQuery
            });

            const buckets = (((aggregationResult || {}).aggregations || {}).uniq || {}).buckets || null;

            if (Array.isArray(buckets)) {
                result = buckets.map(({key}) => key);
            }
        }


        return result;
    }

    /**
     * Insert arvchive documents for a given tenantId.
     *
     * @function insertArchiveDocuments
     * @param {string} tenantId
     * @param {string} day - Day of the archive run
     * @param {array} documents
     * @return {Promise}
     * @fulfil {boolean} Insert successful?
     * @reject {Error}
     */
    async insertArchiveDocuments(tenantId, day, documents) {
        let done   = [];
        let failed = [];

        const indexName = ArchiveConfig.getYearlyArchiveName(tenantId, day);

        for (const doc of documents) {
            try {
                const result = await this.elasticsearch.create({
                    index: indexName,
                    id: doc.transactionId,
                    type: this.elasticsearch.defaultDocType,
                    body: doc
                });

                if (result && result.created) {
                    done.push(doc);
                } else {
                    failed.push(doc);
                }
            } catch (e) {
                failed.push(doc);
            }
        }

        return {
            done,
            failed
        };
    }

    /**
     * Iterate a list of transactions Ids, fetch all events for that transaction,
     * filter them by visibility taken from individual events and map them to archive entries.
     *
     * @async
     * @function mapTransactionsToArchiveEntries
     * @param {string} tenantId
     * @param {array} transactionIds
     * @return {Promise}
     * @fulfil {array} List of archive entries, ready for insert do elasticsearch
     * @reject {Error} ???
     */
    async mapTransactionsToArchiveDocument(tenantId, transactionIds) {
        let result = [];

        for (const transactionId of transactionIds) {
            const events = await this.getEventsByTransactionId(transactionId, tenantId);

            if (this.transactionHasArchivableContent(events)) {
                this.logger.log(`${this.klassName}:mapTransactionsToArchiveDocument: Transaction ${transactionId} has archivable content. Continueing.}`);

                const filteredEvents = this.filterEventsByTenantAndAccessLevel(tenantId, events);
                const archiveEntry   = this.eventsToArchive(tenantId, transactionId, filteredEvents);

                if (archiveEntry) {
                    result.push(archiveEntry);
                }
            } else {
                this.logger.log(`${this.klassName}:mapTransactionsToArchiveDocument: Transaction ${transactionId} has no archivable content. Skipping.}`);
            }
        }

        return result;
    }

    /**
     * Update metadata for all blob references found in the given archive documents.
     *
     * @function processAttachments
     * @param {array} documents - List of archive docuemtns
     * @return {object} Done and failed documents
     */
    async processAttachments(documents) {
        let done = [];
        let failed = [];

        for (const doc of documents) {
            try {

                if ((((doc || {}).document || {}).files || {}).inbound)
                    await this.setReadonly(doc.document.files.inbound);

                if ((((doc || {}).document || {}).files || {}).outbound)
                    await this.setReadonly(doc.document.files.outbound);

                if ((((doc || {}).document || {}).files || {}).inboundAttachments && Array.isArray(doc.document.files.inboundAttachments) && doc.document.files.inboundAttachments.length > 0)
                    await this.setReadonly(doc.document.files.inboundAttachments);

                if ((((doc || {}).document || {}).files || {}).outboundAttachments && Array.isArray(doc.document.files.outboundAttachments) && doc.document.files.outboundAttachments.length > 0)
                    await this.setReadonly(doc.document.files.outboundAttachments);

                done.push(doc);
            } catch (e) {
                this.logger.error(`${this.klassName}#processAttachments: Failed to set readonly on files for docuemnt.`, doc, e);
                failed.push(doc);
            }
        }

        return {
            done,
            failed
        };
    }

    /**
     * Function to set readOnly flag to files on blob.
     *
     * @todo move to base class
     *
     * @async
     * @function setReadonly
     * @param {Array} attachments - List of blob references.
     * @returns {Promise}
     * @fulfills {Object} Structure of successful and failed operations.
     */
    async setReadonly(attachments = []) {
        let done   = [];
        let failed = [];

        for (const attachment of attachments) {
            try {
                const blobPath = `/api${attachment.reference}`.replace('/data/private', '/data/metadata/private');
                let result = await this.serviceClient.patch('blob', blobPath, {readOnly: true}, true);
                done.push(result);
            } catch (e) {
                this.logger.error('FileProcessor#setReadonly: Failed to set readonly flag on attachment. ', attachment.reference, e);
                failed.push(attachment);
            }
        }

        return {done, failed};
    }

    /**
     * Check if a given list of events has archivable content.
     *
     * @function transactionHasArchivableContent
     * @param {array} events - List of events belonging to a single transaction
     * @return {boolean}
     */
    transactionHasArchivableContent(events) {
        return events.some((e) => e && e.archivable);
    }

    /**
     * Augment a given ES query by tenantId clause.
     * The query has to contain a valid bool query to be augmented.
     *
     * @function _addTenantIdClause
     * @param {object} query - The ES query to augemnt
     * @return {object} Augmented query
     * @throws {Error} If the query is not in the right shape / does not already contain a bool filter.
     */
    _addTenantIdClause(q, tenantId) {
        const hasFilter = ((((q || {}).bool || {}).filter || {}).bool || {}).should || null;
        if (!Array.isArray(hasFilter)) {
            throw new Error('Query not ready for augmentation.');
        }

        /** Set tenantId to all fields possibly containing it. */
        q.bool.filter.bool.should.push({term: {'event.sender.originator': tenantId}});
        q.bool.filter.bool.should.push({term: {'event.receiver.target': tenantId}});

        if (tenantId.startsWith('c_')) {
            const customerId = tenantId.replace(/^c_/, '');
            q.bool.filter.bool.should.push({term: {'event.customerId': customerId}});
        } else if (tenantId.startsWith('s_')) {
            const supplierId = tenantId.replace(/^s_/, '');
            q.bool.filter.bool.should.push({term: {'event.supplierId': supplierId}});
        }

        return q;
    }

}

module.exports = GenericArchiver;
