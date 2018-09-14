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

                    done.push(entry);
                } else {
                    console.error('CustomerMapper#run: No mapping found for email:' + to);
                    failed.push(entry);
                }
            } else {
                console.error('CustomerMapper#run: Entry has no receiver info.');
                failed.push(entry);
            }

        }

        return {
            done,
            failed
        };
    }

};
