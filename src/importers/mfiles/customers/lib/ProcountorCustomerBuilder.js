'use strict';

const csv = require('csvtojson');
const CustomerBuilder = require('./CustomerBuilder');

module.exports = class ProcountorCustomerBuilder extends CustomerBuilder {
    constructor() {
        super();
    }

    async run() {
        let customer = null;
        try {
            let response = await this.api.get(`customer/api/customers?id=ProcountorSE`);

            if (response && response.data && response.data.length === 0) {
                /* Create IKEAAB if it does not exist */
                let result = await this.createCustomer({
                    id: 'ProcountorSE',
                    name: 'Procountor SE',
                    cityOfRegistration: '',
                    countryOfRegistration: 'SE'
                });

                customer = result.data;
            } else {
                customer = response.data[0];
            }
        } catch (e) {
            console.error('Failed to crete ProcountorSE.', e);
            return false;
        }

        if (!customer) {
            console.error('ERR: Failed to create ProcountorSE');
            return false;
        }

        let companies = [];
        try {
            companies = await csv({delimiter: ';'})
                .fromFile('src/importers/mfiles/customers/data/procountor.csv');

            if (companies.length <= 0) {
                throw new Error('Failed to read CSV. Empty result.');
            }
        } catch (e) {
            console.error('Failed to parse ProcountorSE CSV.');
            return false;
        }

        let emails = companies.map((v) => v['RECIPIENTS']);

        /* Create departments */

        let mailToTenantMapping = [];

        for (const email of emails) {
            mailToTenantMapping.push({
                email,
                tenantId: `c_${customer.id}`
            });
        }

        try {
            await this.writeMappingCsv('procountor', mailToTenantMapping);
        } catch (e) {
            console.error('Failed to write procountor mapping CSV.', e);
        }

        return mailToTenantMapping;
    }
};

