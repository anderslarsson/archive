'use strict';

const {format}            = require('date-fns');
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
        let fmtYear = format(date, 'YYYY'); // Returns NOW when  date is undefined

        return `${this.indexPrefix}tenant_yearly-${tId}-${fmtYear}`;
    }

    /**
     * Given a table column (frontend) name this method
     * returns the corresponding elasticsearch field
     * to apply sorting on.
     *
     * @function getSortMappingForField
     * @param {string} fieldName
     * @return {string} Sortable elasticsearch field name
     */
    static getSortMappingForField(fieldName = '') {

        const m = {
            'sourceFrom': 'receiver.protocolAttributes.from.keyword',
            'transactionId': 'transactionId.keyword',
            'start': 'start',
            'lastStatus': 'lastStatus.keyword'
        };

        return m[fieldName];
    }

    static get dailyArchiveJobPendingTopic() {
        return 'archive.dailyArchiveJob.pending';
    }
    static get dailyArchiveJobDoneTopic() {
        return 'archive.dailyArchiveJob.done';
    }

    static get esMapping() {
        return Mapping;
    }

}

module.exports = ArchiveConfig;
