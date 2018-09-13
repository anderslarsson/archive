'use strict';

const csv = require('csvtojson');
const CustomerBuilder = require('./CustomerBuilder');

module.exports = class SiemensCustomerBuilder extends CustomerBuilder {
    constructor() {
        super();
    }

    async run() {
        /* Create Siemens w/o mothership */
        let companies = [];
        try {
            companies = await csv({delimiter: ';'})
                .fromFile('data/siemens.csv');

            if (companies.length <= 0) {
                throw new Error('Failed to read CSV. Empty result.');
            }
        } catch (e) {
            console.error('Failed to parse Siemens CSV.');
            return false;
        }

        let customers = [];
        companies.map((v) => {
            customers.push({
                name: v['CUSTOMER_NAME'],
                countryOfRegistration: v['EMAIL_COUNTRY'],
                email: v['RECIPIENTS'],
                vatIdentificationNo: v['VAT']
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
            await this.writeMappingCsv('siemens', mailToTenantMapping);
        } catch (e) {
            console.error('Failed to write IKEA mapping CSV.', e);
        }

        return mailToTenantMapping;
    }

};
