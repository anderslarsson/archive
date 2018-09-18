'use strict';

const csv = require('csvtojson');
const CustomerBuilder = require('./CustomerBuilder');

module.exports = class IkeaCustomerBuilder extends CustomerBuilder {
    constructor() {
        super();
    }

    async run() {
        /* Create mothership (Ikea AB) */
        try {
            let response = await this.api.get(`customer/api/customers?id=IKEAAB`);

            if (response && response.data && response.data.length === 0) {
                /* Create IKEAAB if it does not exist */
                let result = await this.createCustomer({
                    id: 'IKEAAB',
                    name: 'IKEA AB',
                    cityOfRegistration: 'Almhult',
                    countryOfRegistration: 'SE'
                });

                if (!result || !result.data) {
                    throw new Error('Empty response.');
                }
            }
        } catch (e) {
            console.error('Failed to crete IKEA AB.', e);
            return false;
        }

        let companies = [];
        try {
            companies = await csv({delimiter: ';'})
                .fromFile('src/importers/mfiles/customers/data/ikea.csv');

            if (companies.length <= 0) {
                throw new Error('Failed to read CSV. Empty result.');
            }
        } catch (e) {
            console.error('Failed to parse IKEA CSV.');
            return false;
        }

        let customers = [];
        companies.map((v) => {
            customers.push({
                name: v['CUSTOMER_NAME'],
                countryOfRegistration: v['EMAIL_COUNTRY'],
                email: v['RECIPIENTS'],
                vatIdentificationNo: v['VAT'],
                parentId: 'IKEAAB'
            });
        });

        /* Create departments */

        let mailToTenantMapping = [];

        for (const customer of customers) {
            try {
                let c = Object.assign({}, customer);
                delete c.email;

                let result = await this.createCustomer(c);

                if (result && result.data) {
                    mailToTenantMapping.push({
                        email: customer.email,
                        tenantId: `c_${result.data.id}`
                    });
                }
            } catch (e) {
                console.error('Failed to create customer ' + customer.name, e);
            }
        }

        try {
            await this.writeMappingCsv('ikea', mailToTenantMapping);
        } catch (e) {
            console.error('Failed to write IKEA mapping CSV.', e);
        }

        return mailToTenantMapping;
    }
};
