'use strict';

const EventClient   = require('@opuscapita/event-client');
const Logger        = require('ocbesbn-logger');
const elasticsearch = require('../../shared/elasticsearch');

class Worker {

    /**
     * @constructor
     */
    constructor(db) {

        this.db            = db;
        this.elasticsearch = elasticsearch;
        this.eventClient   = null;
        this.logger        = null;
        this.activeSince   = null; // Contains a timestamp of the last processing start if active, otherwise null

    }

    async init() {
        this.logger = new Logger({
            context: {
                serviceName: 'archive'
            }
        });

        this.eventClient = new EventClient({
            exchangeName: 'archive',
            messageLimit: 1,
            consul: {
                host: 'consul'
            }
        });

        await this.elasticsearch.init();
        await this.initEventSubscriptions();

        return true;
    }

    async initEventSubscriptions() {

        if (process.env.NODE_ENV !== 'testing') {
            try {
                await this.eventClient.init();
                await this.eventClient.subscribe('archive.curator.checkTransactionLog', this.checkTransactionLog.bind(this));
            } catch (e) {
                this.logger.error('TransactionLogCheckWorker#init: faild to initially subscribe to the ');
                throw e;
            }

        }

        return true;
    }

    async checkTransactionLog(msg) {
        this.activeSince = Date.now();

        let success = false;
        try {
            success = await this.doCheckTransactionLog(msg);
        } catch (e) {
            this.logger.error('Exception caught in TransactionLogCheckWorker: ', e);
            success = false;
        }

        this.logger.info('Processing transaction log check finished at ', Date.now(), 'with result: ', success);
        this.activeSince = null;

        return true;
    }

    async doCheckTransactionLog(msg) {
        this.logger.log(msg);

        const transactionLogs = await this.fetchTransactionLogs();
        let documentExistance = await this.checkDocumentExistance(transactionLogs);

        let failed = documentExistance.filter(e => e.docCount !== 1);

        if (failed.lenght > 0) {
            this.logger.error('TransactionLogCheckWorker: found ', failed.lenght, ' failed transactions.', failed);
        } else {
            this.logger.log('TransactionLogCheckWorker: All transactions good! ');
        }

        return true;
    }

    /**
     * Fetch all transcation logs from the past 24h
     *
     * @async
     * @function fetchTransactionLogs
     * @return {array}
     */
    async fetchTransactionLogs() {
        let logEntries = [];
        try {
            const ArchiveTransactionLog = await this.db.modelManager.getModel('ArchiveTransactionLog');
            logEntries = await ArchiveTransactionLog.findAll({
                where: {
                    createdOn: {
                        $gt: new Date(new Date() - 24 * 60 * 60 * 1000)
                    }
                }
            });
        } catch (e) {
            this.logger && this.logger.error('Failed to fetch transaction logs with exception: ', e);
        }

        return logEntries;
    }

    /**
     * Checks existance on ES for a list of transaction logs.
     *
     * @async
     * @function checkDocumentExistance
     * @param {array} transactionLogs
     * @return {array<object>} List of transactionIds and their existance state
     */
    async checkDocumentExistance(transactionLogs) {
        let documentExistance = [];
        for (const log of transactionLogs) {
            let {transactionId, status} = log.dataValues;
            let docCount = 0;
            try {
                docCount = await this.existsOnEs(transactionId);
            } catch (e) {
                this.logger.error('Failed to query for existence of transactionId ', transactionId, 'with exception ', e);
                docCount = false;
            }
            documentExistance.push({transactionId, status, docCount});
        }
        return documentExistance;
    }

    /**
     * Check if a document for the given transactionId exists on ES.
     *
     * @async
     * @function existsOnEs
     * @param {string} transactionId
     * @return {number} count of documents found for the given transactionId
     */
    async existsOnEs(transactionId) {
        if (!transactionId || typeof transactionId !== 'string' || transactionId.lenght <= 0) {
            throw new Error('Empty transactionId');
        }

        let result = await this.elasticsearch.client.search({
            index: 'archive_invoice_tenant_yearly*',
            body: {
                query: {
                    bool: {
                        must: {
                            term: {
                                'transactionId': transactionId
                            }
                        }
                    }
                },
                sort: {
                    'start': {
                        order: 'asc'
                    }
                }
            }
        });

        return result.hits.total;
    }

};

module.exports = Worker;

