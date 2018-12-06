'use strict';

const moment              = require('moment');
const {normalizeTenantId} = require('./helpers');
const ErrCodes            = require('./error_codes');
const MsgTypes            = require('./msg_types');
const Mapping             = require('./elasticsearch/archive/Mapping');

class ArchiveConfig {

    static get errCodes() {
        return ErrCodes;
    }

    static get msgTypes() {
        return MsgTypes;
    }

    static get indexPrefix() {
        return 'archive_';
    }

    /**
     * Build the index name of a yearly achive for
     * a given tenant and a date.
     *
     * @static
     * @function getYearlyArchiveName
     * @param {string} tenantId
     * @param {date} date - Date that will define the year in the index name.
     * @return {string} Name of the index
     */
    static getYearlyArchiveName(tenantId, date) {
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

    static get logrotationJobCreatedQueueName() {
        return 'archive.logrotationJob.created';
    }
    static get finishedLogrotationJobQueueName() {
        return 'archive.logrotationJob.finished';
    }

    static get esMapping() {
        return Mapping;
    }

}

module.exports = ArchiveConfig;
