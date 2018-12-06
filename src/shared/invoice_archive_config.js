'use strict';

const moment              = require('moment');
const {normalizeTenantId} = require('./helpers');
const ErrCodes            = require('./error_codes');
const MsgTypes            = require('./msg_types');
const Mapping             = require('./elasticsearch/archive/Mapping');

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

    /**
     * @deprecated
     */
    static monthlyTenantArchiveName(tenantId) {
        let tId = normalizeTenantId(tenantId);
        let fmtMonth = moment().format('YYYY.MM');

        return `${this.indexPrefix}tenant_monthly-${tId}-${fmtMonth}`;
    }

    static yearlyTenantArchiveName(tenantId, date) {
        let tId = normalizeTenantId(tenantId);
        let fmtYear = moment(date).format('YYYY'); // Returns NOW when  date is undefined

        return `${this.indexPrefix}tenant_yearly-${tId}-${fmtYear}`;
    }

    static getSortMappingForField(fieldName = '') {

        const m = {
            'sourceFrom': 'receiver.protocolAttributes.from.keyword',
            'transactionId': 'transactionId.keyword',
            'start': 'start',
            'lastStatus': 'lastStatus.keyword'
        };

        return m[fieldName];
    }

    static get newArchiveTransactionJobQueueName() {
        return 'archive.invoice.archiveTransactionJob.created';
    }
    static get finishedArchiveTransactionJobQueueName() {
        return 'archive.invoice.archiveTransactionJob.finished';
    }

    static get newLogrotationJobQueueName() {
        return 'archive.invoice.logrotationJob.created';
    }
    static get finishedLogrotationJobQueueName() {
        return 'archive.invoice.logrotationJob.finished';
    }

    static get esMapping() {
        return Mapping;
    }

}

module.exports = {
    ErrCodes,
    InvoiceArchiveConfig,
    MsgTypes
};
