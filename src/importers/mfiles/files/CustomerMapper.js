'use strict';

module.exports = class CustomerMapper {

    constructor() {
    }

    async run(archiveEntries) {
        let done   = [];
        let failed = [].concat(archiveEntries.failed);

        // !!!!!! FIXME - for testing purposes only
        for (const entry of archiveEntries.done) {
            entry.customerId = 'OC001';
            entry.receiver.target = 'OC001';

            done.push(entry);
            // archiveEntries[i].start = '2011-11-11';
            // archiveEntries[i].end = '2011-11-11';
        }

        return {
            done,
            failed
        };
    }

};
