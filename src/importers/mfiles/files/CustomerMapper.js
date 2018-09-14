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


        // !!!!!! FIXME - for testing purposes only
        for (const entry of archiveEntries.done) {

            let success = false;
            let failureMessage = '';

            if (entry && entry.receiver && entry.receiver.protocolAttributes && entry.receiver.protocolAttributes.to) {
                const to = entry.receiver.protocolAttributes.to;

                let tenantId = customerMapping.find((v) => {
                    if (v.email) {
                        return v.email.toLowerCase() === to.toLowerCase();
                    } else {
                        return false;
                    }
                });

                if (tenantId) {
                    entry.customerId = tenantId;
                    entry.receiver.target = tenantId;

                    success = true;

                } else {
                    failureMessage = 'CustomerMapper#run: No mapping found for email: ' + to;
                    console.error(failureMessage);
                    success = false;
                }
            } else {
                failureMessage = 'CustomerMapper#run: Entry has no receiver info.';
                console.error(failureMessage);
                success = false;
            }

            if (success) {
                done.push(entry);
            } else {
                entry._errors.stage.customerMapping.push({
                    type: 'customer_mapping_failed',
                    message: failureMessage
                });
                failed.push(entry);
            }

        }

        return {
            done,
            failed
        };
    }

};
