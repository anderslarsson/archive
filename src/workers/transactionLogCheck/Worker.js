'use strict';

const ServiceClient = require('ocbesbn-service-client');
const EventClient   = require('@opuscapita/event-client');
const config        = require('@opuscapita/config');
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
        this.report        = []; // Array of strings containing report entries

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

        this.serviceClient = new ServiceClient();

        await config.init();

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
        this.report = [];

        this.report.push(`Starting check ${this.activeSince}`);

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

        if (transactionLogs && transactionLogs.length === 0) {
            this.report.push('No transactions found in the current timeframe. Quitting. \n');
        } else {
            await this.reportFailed(transactionLogs);
            await this.checkDocumentExistance(transactionLogs);
        }

        await this.sendReport();

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

        this.report.push('---\n');
        this.report.push('Checking existance of documents on elasticsearch: \n');

        const doneTransactions = transactionLogs.filter(e => e.dataValues.status === 'done');

        for (const log of doneTransactions) {
            let {transactionId, status} = log.dataValues;
            let docCount = 0;
            try {
                docCount = await this.existsOnEs(transactionId);
            } catch (e) {
                this.report.push('Failed to query for existence of transactionId ', transactionId, 'with exception ', e);
                docCount = false;
            }
            documentExistance.push({transactionId, status, docCount});
        }


        let failed = documentExistance.filter(e => e.docCount !== 1);

        if (failed.length > 0) {
            this.report.push(`Found ${failed.length} transactions with status=DONE that exist in log but not on elasticsearch. \n`);
            this.report.push('transactionId, status, document count');

            for (const t of failed) {
                this.report.push(`${t.transactionId}, ${t.status}, ${t.docCount}\n`);
            }

            this.report.push('\n');
        } else {
            this.report.push('TransactionLogCheckWorker: All transactions with status=DONE good! \n');
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
        if (!transactionId || typeof transactionId !== 'string' || transactionId.length <= 0) {
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

    /**
     * Reports all transactions that have state that is != 'done'.
     *
     * @function reportFailed
     * @param {array} transactionLogs
     * @return {array<object>} List of transactionIds and their existance state
     */
    reportFailed(transactionLogs) {
        this.report.push('---\n');
        this.report.push('Checking for transactions that with status != DONE: \n');

        const failed = transactionLogs.filter(e => e.dataValues.status !== 'done');

        if (failed.length > 0) {
            for (const log of failed) {
                let {transactionId, status} = log.dataValues;

                this.report.push(`${transactionId}, ${status}`);
            }
        } else {
            this.report.push('All transactions have status == DONE, all good! \n');
        }

        this.report.push('\n');
    }

    /**
     * Sends the report via email service.
     *
     * @async
     * @function sendReport
     */
    async sendReport() {
        try {
            let result = await this.serviceClient.post('email', '/api/send', {
                to: 'dennis.buecker@opuscapita.com, thomas.klassen@opuscapita.com',
                subject: 'Invoice transaction log check report',
                text: this.report.join('\n'),
            }, true);

            this.logger.log('Email report sent with status: ', result);
        } catch (e) {
            this.logger.error('Failed to send report.', this.report, e);
        }
    }
};

module.exports = Worker;

