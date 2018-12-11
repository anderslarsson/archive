'use strict';

const {format, subDays} = require('date-fns');

const dbInit        = require('@opuscapita/db-init'); // Database
const Logger        = require('ocbesbn-logger');
const ServiceClient = require('ocbesbn-service-client');

const elasticsearch = require('../../shared/elasticsearch');
// const Mapper        = require('./Mapper');

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
            this.db = await dbInit.init();
            await this.elasticsearch.init();
        } catch (e) {
            this.logger.error(this.klassName, '#init: Failed to initialize with exception.' , e);
        }

        return true;
    }

    /**
     * Run all transactions from a single day for the given tenant from
     * TnT log to the archive.
     *
     * @async
     * @function updateDailyArchive
     * @param {string} tenantId
     * @param {date} date - The day that should be archived
     * @returns {boolean} Success indicator
     */
    async doDailyArchiving(tenantId, date = Date.now()) {
        const day = format(subDays(date, this._tntOffset), 'YYYY-MM-DD');

        /**
         * @see tnt service how it is done there
         *
         * 0. Log start of processing
         *     0.1. Check that job has not already run
         * 1. Find all transactionIds on that day where tenantId is receiver or sender
         * 2. Iterate result from 1. and fetch all events for a single transaction
         * 3. Filter result from 2. based on:
         *     - Log access
         *     - archivable
         * 4. Transform result from 3. into archive entry.
         * 5. Log end of processing
         */

        this.logger.info(this.klassName, day);

        return false;
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
