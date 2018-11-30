'use strict';

const EventClient = require('@opuscapita/event-client');
const Logger      = require('ocbesbn-logger');

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
        await this.archiver.init();
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
            this._logger = new Logger({
                context: {
                    serviceName: 'archive'
                }
            });
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

        if (process.env.NODE_ENV !== 'testing') {
            try {
                /* Subscribe w/o callback to trigger queue creation and binding. */
                // await this.eventClient.subscribe(InvoiceArchiveConfig.newLogrotationJobQueueName);
                // await this.eventClient.subscribe(InvoiceArchiveConfig.newArchiveTransactionJobQueueName);
            } catch (e) {
                this.logger.error('InvoiceArchiveWorker#init: faild to initially subscribe to the ');
                throw e;
            }

            /** Enter main loop to keep the process running. */
            this.mainLoop();
        }

        return true;
    }

    /**
     * @todo remove as soon as worker supports subscribing to a event topic.
     */
    async mainLoop() {
        try {
            console.log(Date.now(), ' - I am alive');
        } catch (e) {
        } finally {
            // Restart the timer
            this._mainLoopTimeout = setTimeout(this.mainLoop.bind(this), 5000);
        }
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
