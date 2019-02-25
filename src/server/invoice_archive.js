'use strict';

/**
 * InvoiceArchive context module
 *
 * This module is responsible for creating archiving jobs on the event bus. This
 * events will be consumed by the worker pool.
 */

const EventClient = require('@opuscapita/event-client');
const {
    MsgTypes,
    InvoiceArchiveConfig
} = require('../shared/invoice_archive_config');

const events = new EventClient({
    exchangeName: 'archive',
    consul: {
        host: 'consul'
    }
});

/**
 * TODO still needed or deprecated?
 *
 * @deprecated
 * @function archiveTransaction
 * @param {String} transactionId
 * @returns {Boolean} Indicates the success of job creation
 */
module.exports.archiveTransaction = async function (transactionId) {
    await events.emit(InvoiceArchiveConfig.newArchiveTransactionJobQueueName, {
        type: MsgTypes.ARCHIVE_TRANSACTION,
        transactionId
    });
};
