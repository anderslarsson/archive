'use strict';

const EventClient = require('@opuscapita/event-client');
const Logger      = require('ocbesbn-logger');

const ArchiveConfig   = require('../../shared/ArchiveConfig');
const GenericArchiver = require('./Archiver');

class GenericWorker {

    /**
     * @constructor
     * @param {object} db - Instance of DbInit
     */
    constructor(db) {
        this._db              = db;
        this._archiver        = new GenericArchiver(this.eventClient, this.logger);
        this._mainLoopTimeout = null;
    }

    async init() {
        await this.initEventSubscriptions();
        // await this.archiver.init();
        return true;
    }

    /** *** GETTER *** */

    get archiver() {
        return this._archiver;
    }

    get db() {
        return this._db;
    }

    get klassName() {
        return this.constructor.name || 'GenericWorker';
    }

    get logger() {
        if (!this._logger) {
            this._logger = new Logger({context: {serviceName: 'archive'}});
        }

        return this._logger;
    }

    get eventClient() {
        if (!this._eventClient) {
            this._eventClient = new EventClient({
                exchangeName: 'archive',
                messageLimit: 1,
                consul: {
                    host: 'consul'
                }
            });
        }

        return this._eventClient;
    }

    async initEventSubscriptions() {
        if (process.env.NODE_ENV === 'testing') {
            return true; // !!!
        }

        try {
            await this.eventClient.subscribe(ArchiveConfig.dailyArchiveJobPendingTopic, this.onDailyArchiveJobPending.bind(this));
        } catch (e) {
            this.logger.error(this.klassName, '#init: Failed to subscribe to the message queue(s).', e);
            throw e;
        }

        return true;
    }

    /**
     * Event handler for event queue messages on the 'dailyArchiveJob.pending' topic.
     *
     * @async
     * @function onDailyArchiveJobPending
     * @param {object} message - Application payload received on the topic subscription
     * @param {object} ctx - Context provided by the EventClient (extracted from the message)
     * @param {string} topic - The topic the message was created with.
     * @param {string} subject - The subject (routingKey in Rabbit) the message was produuced with
     */
    async onDailyArchiveJobPending(message, ctx, topic, subject) {
        this.logger.info(this.klassName, `#onDailyArchiveJobPending: Received request to run daily TnT logs to archive on subject >>> ${subject} <<<.`, message);

        const {tenantConfig, date} = message;

        debugger;

        let result = true;
        try {
            result = await this.archiver.doDailyArchiving(tenantConfig.tenantId, date);
        } catch (e) {
            this.logger.error(this.klassName, `#onDailyArchiveJobPending: Failed to run daily archive job for tenantId ${tenantConfig.tenantId}. Got exception.`, e);
            result = false;
        }

        return result;
    }

    /**
     * Update the archive transaction log.
     *
     * @todo Move to base class
     *
     * @async
     * @function updateArchiveTransactionLog
     * @param {string} transactionId
     * @param {string} key - Model field to update (database column)
     * @param {string} value - New field value
     * @returns {boolean} Success indicator
     */
    async updateArchiveTransactionLog(transactionId, key, value) {
        let success = false;
        try {
            const ArchiveTransactionLog = await this.db.modelManager.getModel('ArchiveTransactionLog');
            let logEntry = await ArchiveTransactionLog.find({where: {transactionId: transactionId}});

            if (logEntry) {
                await logEntry.set(key, value);
                await logEntry.save();

                success = true;
            }
        } catch (e) {
            success = false;
            this.logger.error(`Failed to update ArchiveTransactionLog entry for transactionId ${transactionId}.`);
        }
        return success;
    }

}

module.exports = GenericWorker;
