'use strict';

const xml = require('fast-xml-parser');
const fs = require('fs');
const moment = require('moment');

const simpleParser = require('mailparse').simpleParser;
const Promise = require('bluebird');

const {Client} = require('elasticsearch');
const {Blob} = require('../../client/api');

// const homeDir = require('os').homedir();
// const dataDir = `${homeDir}/tmp/SIE_export`;
const dataDir = `../Test-export`;

const ES_HOST = process.env.ES_HOST || 'elasticsearch:9200';

const options = {
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

const esClient = new Client({
    apiVersion: '5.5',
    hosts: [
        ES_HOST
    ]
});

const blobApi = new Blob();

function main() {
    let indexXml = fs.readFileSync(`${dataDir}/Index.xml`);
    let archive = xml.parse(indexXml.toString(), options)
        .archive;

    // Fetch vault ID from archive to get the file path
    let vaultId = archive.vault.attr['@_guid'].replace(/{|}/g, '');

    let contentXmls = archive['#text']
        .split('\n')
        .filter((e) => e.match(/content/))
        .map((e) => e.replace(/&|;/g, ''));

    if (vaultId && contentXmls.length) {
        let objects = contentXmls
            .map(readContentXml)
            .reduce((acc, val) => acc.concat(val), []);

        let files = objects.map(parseObjectMeta);

        let existingFiles = files
            .filter((f) => fs.existsSync(`${dataDir}/${f.path}`));

        // consoleReport(existingFiles[0]);

        existingFiles.forEach(async (f) => {

            //   TODO
            // * get email text from eml for ES indexing
            // * put file to blob storage
            // * create archive entry

            let mail = getContentOfEmlFile(f);
            let tenantId = getTenantIdFromMapping(f.metadata.to);
            let index = createIndex(tenantId, f.metadata.date);
            let body = createBodyToIndex(f, tenantId, mail);

            let blobResult = await storeToBlob(body);
            let esResult = await indexToES(f.id, index, body);
        });
    }
}

/**
 * Function to debug data..
 */
async function consoleReport(f) {
    console.log('\nEml File Path: ');
    console.log(f.path);

    console.log(`\nProps in Content.xml:`);
    console.log(JSON.stringify(f.metadata, null, 2));

    let eml = fs.readFileSync(`${dataDir}/${f.path}`, 'utf8');
    let mail = await simpleParser(eml);

    console.log(`\nProps in Eml File:`);
    console.log(JSON.stringify({
        from: mail.from.value[0].address,
        to: mail.to.value[0].address,
        date: mail.date,
        subject: mail.subject,
        text: mail.textAsHtml || mail.html
    }, null, 2));

    console.log(`\nAttachment:`);
    console.log(mail.attachments);

    debugger;
}

/**
 * Reads, parses and returns the content of .eml file
 *
 * @param {Object} f should include path to .eml file
 */
async function getContentOfEmlFile(f) {
    let eml = fs.readFileSync(`${dataDir}/${f.path}`, 'utf8');
    return await simpleParser(eml);
}

/**
 * Reads, parses and returns the content of content.xml file
 *
 * @return {Array} - List of object entries
 */
function readContentXml(entityName) {
    let capitalizedEntityName = entityName.trim().replace(/^\w/, c => c.toUpperCase());

    let contentXml = fs.readFileSync(`${dataDir}/Metadata/${capitalizedEntityName}.xml`);
    let content = xml.parse(contentXml.toString(), options).content;

    return content.object;
}

/**
 * Extracts the object properties from the Content.xml
 *
 * @return {Object} - Built custom object including properties
 */
function parseObjectMeta(obj) {
    let path = obj.version.docfiles.docfile.attr['@_pathfrombase']
        .replace(/\\/g, '/');

    let props = obj.version.properties.property;
    let id = getObjectProp(props, 'MailID');
    let title = getObjectProp(props, 'Name or title');
    let subject = getObjectProp(props, 'Subject');
    let size = getObjectProp(props, 'Size on server (this version)');
    let from = getObjectProp(props, 'From');
    let to = getObjectProp(props, 'To');
    let buyer = getObjectProp(props, 'Buyer');
    let date = getObjectProp(props, 'Date');
    let archiveEndDate = getObjectProp(props, 'Archiving ends');

    return {
        id,
        path,
        metadata: {
            title,
            subject,
            size,
            from,
            to,
            buyer,
            date,
            archiveEndDate
        }
    };
}

/**
 * Helper function to extract text from property tag
 *
 * @return {Object} - value of the property with given name
 */
function getObjectProp(props, propName) {
    let prop = props.find((p) => p.attr['@_name'] === propName);
    if (prop) {
        return prop['#text'];
    }
}

// =========== Es Related Functions ===========
async function storeToBlob(body) {

    return Promise.all(
        body.attachments.map(attachment => {
            const path = `private/invoice/purchaseInvoices/${body.id}/attachments/${attachment.name}`;
            return blobApi.uploadFileAsFormData(body.tenantId, path, attachment);
        }))
        .then((responses) => {
            body.attachments.forEach((attachment) => {
                let response = responses.find((r) => r.path.includes(attachment.name));
                attachment.blobServicePath = response.path;
            });
            return body;
        })
        .catch((err) => {
            // TODO: could not store file to blob service, what to do...
            throw Error(err);
        });
}

function createBodyToIndex(f, tenantId, mail) {
    f.tenantId = tenantId;
    f.metadata.text = mail.textAsHtml || mail.html;
    f.metadata.attachments = [];

    (mail.attachments || []).forEach((attachment) => {
        f.metadata.attachments.push({
            contentType: attachment.contentType,
            filename: attachment.filename,
            checksum: attachment.checksum,
            size: attachment.size,
        });
    });

    return f;
}

function createIndex(tenantId, dateObj) {
    let normalTenantId = normalizeTenantId(tenantId);

    let date = moment(dateObj);
    let fmtDate = date.format('YYYY.MM.DD');
    let fmtDatesMonth = date.format('YYYY.MM');
    let fmtDatesYear = date.format('YYYY');

    let current = moment();
    let yearlyIndex = current.diff(date, 'years');
    let monthlyIndex = current.diff(date, 'months');
    let dailyIndex = current.diff(date, 'days');

    if (yearlyIndex)
        return `archive_tenant_yearly-${normalTenantId}-${fmtDatesYear}`;
    if (monthlyIndex)
        return `archive_tenant_monthly-${normalTenantId}-${fmtDatesMonth}`;
    if (dailyIndex)
        return `archive_global_daily-${fmtDate}`;

    return `bn_tx_logs-${fmtDate}`;
}

function getTenantIdFromMapping(toAddress) {
    return toAddress;
}

function normalizeTenantId(tenantId) {
    let normalizedTenantId = tenantId;

    if (tenantId && tenantId.toLowerCase) {
        normalizedTenantId = tenantId.toLowerCase();
    }

    return normalizedTenantId;
}

async function indexToES(id, index, body) {
    return esClient.index({
        id: id,
        type: '_doc',
        body: body,
        index: index,
        opType: 'create',
        timestamp: body.date,
        ttl: body.archiveEndDate
    });
}

main();
