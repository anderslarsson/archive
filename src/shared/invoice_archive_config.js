'use strict';

const MsgTypes = {
  CREATE_GLOBAL_DAILY: 'create_global_daily',
  UPDATE_TENANT_MONTHLY: 'update_tenant_monthly',
  UPDATE_TENANT_YEARLY: 'update_tenant_yearly',
  ARCHIVE_TRANSACTION: 'archive_transaction'
};

const ErrCodes = {
  ERR_INDEX_DOES_NOT_EXIST: 'ERR_INDEX_DOES_NOT_EXIST',
  ERR_SRC_INDEX_DOES_NOT_EXIST: 'ERR_SRC_INDEX_DOES_NOT_EXIST',
  ERR_INDEX_OPEN_FAILED: 'ERR_INDEX_OPEN_FAILED'
};

class InvoiceArchiveConfig {

  static get errCodes() {
    return ErrCodes;
  }

  static get msgTypes() {
    return MsgTypes;
  }

  static get indexPrefix() {
    return 'archive_invoice_';
  }

  static get newArchiveTransactionJobQueueName() {
    return 'archive.invoice.archive.job.created';
  }
  static get finishedArchiveTransactionJobQueueName() {
    return 'archive.invoice.archive.job.finished';
  }

  static get newLogrotationJobQueueName() {
    return 'archive.invoice.logrotation.job.created';
  }
  static get finishedLogrotationJobQueueName() {
    return 'archive.invoice.logrotation.job.finished';
  }

  static get esMapping() {
    return {}; // TODO
  }
}

module.exports = {
  ErrCodes,
  InvoiceArchiveConfig,
  MsgTypes
};
