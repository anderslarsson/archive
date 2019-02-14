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
            const transactionIds = await this.getUniqueTransactionIdsByDayAndTenantId(tenantId, day);
            const archiveDocs    = await this.mapTransactionsToArchiveDocument(tenantId, transactionIds);
            const insertResult   = await this.insertArchiveDocuments(tenantId, day, archiveDocs);

            this.logger.info(`${this.klassName}#doDailyArchiving: Finished with insertResult: `, insertResult);

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
     * @param transactionId {string}
     * @returns {Promise}
     * @fulfil All events belonging to a transaction
     * @reject {Eroro}
     */
    async getEventsByTransactionId(transactionId) {
        const query = {
            body: {
                index: `${this._tntLogPrefix}*`,
                query: {
                    bool: {
                        filter: [
                            {term: {'event.transactionId': transactionId}},
                            {terms: {'event.logAccess': ['Sender', 'Receiver', 'Both']}}
                        ]
                    }
                },
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

        const q = {
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

        /** Fetch overall document count matching the query. */
        const {count} = await this.elasticsearch.count({
            index,
            body: {
                query: q
            }
        });

        /** Fetch unique transactions IDs by tenantId and date. */
        result = await this.elasticsearch.search({
            index,
            body: {
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
            }
        });

        return result.aggregations.uniq.buckets.map(({key}) => key);
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
                    done.push(doc.transactionId);
                } else {
                    failed.push(doc.transactionId);
                }
            } catch (e) {
                failed.push(doc.transactionId);
            }
        }

        return failed.length === 0;
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
            const events         = await this.getEventsByTransactionId(transactionId);
            const filteredEvents = this.filterEventsByTenantAndAccessLevel(tenantId, events);
            const archiveEntry   = this.eventsToArchive(tenantId, transactionId, filteredEvents);

            result.push(archiveEntry);
        }

        return result;
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

}

module.exports = GenericArchiver;
