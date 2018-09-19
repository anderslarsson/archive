'use strict';

const csv = require('csvtojson');

module.exports = class CustomerMapper {

    constructor(pathToMapping) {
        this.pathToMapping = pathToMapping;
    }

    async run(archiveEntries) {
        let done   = [];
        let failed = [].concat(archiveEntries.failed);

        const customerMapping = await csv({delimiter: ';'})
            .fromFile(this.pathToMapping);

        for (const entry of archiveEntries.done) {

            let success = false;

            if (entry && entry.receiver && entry.receiver.protocolAttributes && entry.receiver.protocolAttributes.to) {
                const to = entry.receiver.protocolAttributes.to;

                let row = customerMapping.find((v) => {
                    if (v.email) {
                        return v.email.toLowerCase() === to.toLowerCase();
                    } else {
                        return false;
                    }
                });

                if (row) {
                    let customerId = row.tenantId.replace(/^c_/, '');

                    entry.customerId = customerId;
                    entry.receiver.target = customerId;

                    success = true;
                } else {
                    let failureMessage = 'CustomerMapper#run: No mapping found for email: ' + to;
                    entry._errors.stage.customerMapping.push({
                        type: 'customer_mapping_failed_no_mapping',
                        message: failureMessage,
                        data: to
                    });

                    // console.error(failureMessage);
                    success = false;
                }
            } else {
                let failureMessage = 'CustomerMapper#run: Entry has no receiver info.';
                entry._errors.stage.customerMapping.push({
                    type: 'customer_mapping_failed_no_receiver',
                    message: failureMessage
                });

                // console.error(failureMessage);
                success = false;
            }

            if (success) {
                done.push(entry);
            } else {
                failed.push(entry);
            }

        }

        return {
            done,
            failed
        };
    }

};
