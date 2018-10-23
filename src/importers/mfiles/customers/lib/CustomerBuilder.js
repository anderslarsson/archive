'use strict';

const fs  = require('fs');
const xml = require('fast-xml-parser');
const csv = require('csvtojson');

const ApiHelper = require('./ApiHelper');

const outPath = 'src/importers/mfiles/customers/out';

module.exports = class CustomerBuilder {

    constructor() {
        const config = this.hostsConfig[process.env.TARGET_ENV];
        this.api = new ApiHelper(config);
    }

    async init() {
        return this.api.init();
    }

    async createCustomer(customer) {
        let result = await this.api.post('customer/api/customers', customer);
        return  result;
    }

    async writeMappingCsv(prefix, mappings) {
        if (!fs.existsSync(outPath)) {
            fs.mkdirSync(outPath);
        }

        let writeStream = fs.createWriteStream(`${outPath}/${prefix}.csv`, {flags: 'a+'});

        let data = ['email;tenantId'];
        for (const m of mappings) {
            data.push(`${m.email};${m.tenantId}`);
        }

        let buf = data.join('\n');
        buf = buf + '\n';

        await writeStream.write(buf);

        return await writeStream.end();
    }

    async createArchiveConfig(data) {
        let uniqTenantIds = data.reduce((acc, v) => acc.add(v.tenantId), new Set());

        for (const t of uniqTenantIds) {
            let response = await this.api.post('archive/api/tenantconfig', {tenantId: t});
            if (response && response.data) {
                console.log('CustomerBuilder#createArchiveConfig ', t, response.data.success);
            }
        }
    }

    readXml() {
        const xmlOpts = {
            attributeNamePrefix: '@_',
            attrNodeName: 'attr', //default is 'false'
            textNodeName: '#text',
            ignoreAttributes: false,
            ignoreNameSpace: false,
            allowBooleanAttributes: true,
            parseNodeValue: true,
            parseAttributeValue: true,
            trimValues: true,
            cdataTagName: '__cdata', //default is 'false'
            cdataPositionChar: '\\c',
            localeRange: '', //To support non english character in tag/attribute values.
        };

        let contentXml = fs.readFileSync('data/user_groups.xml');
        let content = xml.parse(contentXml.toString(), xmlOpts);

        return content.structure;
    }

    async buildGroupsWithUsers() {
        const companies = await csv({delimiter: ';'})
            .fromFile('data/EmailArchivingCompanies_20180905.csv');

        let companyNames = companies.reduce((acc, v) => acc.set(v.SAP_COMPANY_NAME, true), new Map());

        const {useraccounts, usergroups} = this.readXml();

        let flatUsers = new Map();
        let groupsWithUsers = new Map();

        for (const user of useraccounts.user) {
            flatUsers.set(user.attr['@_id'], {
                username: user.login.username,
                fullname: user.login.fullname,
                domain: user.login.domain,
                email: user.login.email,
                accounttype: user.login.attr['@_accounttype']
            });
        }

        for (const group of usergroups.group) {
            if (group.members && group.members.user && group.members.user.length > 0) {
                let members = [];

                for (const member of group.members.user) {
                    let userId = member.attr['@_id'];
                    let user = flatUsers.get(userId);

                    if (user) {
                        members.push({
                            id: userId,
                            name: member.attr['@_name'],
                            data: user
                        });
                    } else {
                        console.error(`ERR: User with ID ${userId} not found in users`);
                    }
                }

                groupsWithUsers.set(group.attr['@_name'], {
                    members
                });

            }
        }

        /* Validate companyNames */
        for (const groupName of groupsWithUsers.keys()) {
            if (!companyNames.get(groupName)) {
                console.log(`ERR: Group ${groupName} not in companyNames.`);
            }
        }

    }

    get hostsConfig() {
        return {
            devbox: {
                host: 'localhost',
                port: '8080',
                scheme: 'http',
                username: process.env.TOKEN_AUTH_USERNAME,
                password: process.env.TOKEN_AUTH_PASSWORD,
                clientSecret: process.env.TOKEN_AUTH_CLIENT_SECRET_DEV
            },
            dev: {
                host: 'develop.businessnetwork.opuscapita.com',
                port: '443',
                scheme: 'https',
                username: process.env.TOKEN_AUTH_USERNAME,
                password: process.env.TOKEN_AUTH_PASSWORD,
                clientSecret: process.env.TOKEN_AUTH_CLIENT_SECRET_DEV
            },
            stage: {
                host: 'stage.businessnetwork.opuscapita.com',
                port: '443',
                scheme: 'https',
                username: process.env.TOKEN_AUTH_USERNAME,
                password: process.env.TOKEN_AUTH_PASSWORD_STAGE,
                clientSecret: process.env.TOKEN_AUTH_CLIENT_SECRET_STAGE
            },
            prod: {
                host: 'businessnetwork.opuscapita.com',
                port: '443',
                scheme: 'https',
                username: process.env.TOKEN_AUTH_USERNAME,
                password: process.env.TOKEN_AUTH_PASSWORD_PROD,
                clientSecret: process.env.TOKEN_AUTH_CLIENT_SECRET_PROD
            }
        };
    }

};

