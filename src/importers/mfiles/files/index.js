'use strict';

const xml = require('fast-xml-parser');
const fs  = require('fs');
const he  = require('he');

const Mapper         = require('./Mapper');
const FileProcessor  = require('./FileProcessor');
const api            = require('./Api');
const CustomerMapper = require('./CustomerMapper');

const homeDir = require('os').homedir();
// const dataDir = `${homeDir}/tmp/SIE_export`;
// const dataDir = `${homeDir}/tmp/SIE_redux`;
const dataDir = `${homeDir}/tmp/mfiles_import`;
const mappingDir = `${homeDir}/tmp`;

const moduleIdentifier = 'MFilesImporter';


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
    tagValueProcessor: a => he.decode(a),
    localeRange: '', //To support non english character in tag/attribute values.
};

async function main() {
    await api.init();

    let archiveEntriesStage1, archiveEntriesStage2, archiveEntriesStage3, archiveEntriesStage4;

    try {
        /* STAGE 1: Preprocessing */

        console.log('--- STAGE 1 ---');

        let indexXml        = readEntrypointXml(`${dataDir}/Index.xml`);
        let archiveElem     = fetchArchiveElement(indexXml);
        let contentXmlNames = findContentXmlNames(archiveElem);

        archiveEntriesStage1  = fetchObjectElements(contentXmlNames);

        /* STAGE 2: Create mapping */

        console.log('--- STAGE 2 ---');

        archiveEntriesStage2 = {
            done: xmlToArchiveMapping(archiveEntriesStage1),
            failed: []
        };

        /* STAGE 3: Fetch owner information (tenantId) */

        console.log('--- STAGE 3 ---');

        archiveEntriesStage3 = await doCustomerMapping(archiveEntriesStage2);

        /* STAGE 4: Parse EML files, upload extracted files to blob */

        console.log('--- STAGE 4 ---');

        archiveEntriesStage4 = await processAttachments(archiveEntriesStage3);
        debugger;

        /* STAGE 5: Store in ES */

        console.log('--- STAGE 5 ---');

        // let esResult = await persistToEs(archiveEntriesStage3);
        debugger;

        // TODO handle archiveEntries.failed

    } catch (e) {
        debugger;
        console.error(e);
    }

}

/**
 * @function readContentXml
 *
 * Extracts the object properties from the Content.xml
 *
 * @return {Array} - List of object entries
 */
function readContentXml(entityName) {
    entityName = entityName.trim();

    let capitalizedEntityName = entityName.replace(/^\w/, c => c.toUpperCase());
    let fileName = `${dataDir}/Metadata/${capitalizedEntityName}.xml`;
    let contentXml = fs.readFileSync(fileName);

    console.info(`NFO: Parsing content XML: ${fileName}`);

    let content = xml.parse(contentXml.toString(), options).content;

    return content.object;
}

function xmlToArchiveMapping(objectElements) {
    let result = objectElements
        .map(parseObjectMeta)           // Run the mapper
        .map((e) => {
            e._errors = {       // Create container for errors on every entry
                stage: {
                    fileProcessing: [],
                    persistToEs: [],
                    customerMapping: []
                }
            };

            return e;
        });
    return result;
}

function parseObjectMeta(obj) {
    let mapper = new Mapper(obj);
    let result = mapper.do();

    return result;
}

function readEntrypointXml(filePath) {
    let result;
    try {
        result = fs.readFileSync(filePath);
    } catch (e) {
        result = null;
    }

    if (result) {
        return result;
    } else {
        throw new Error(`${moduleIdentifier}#readEntrypointXml: Failed to read ${filePath}`);
    }
}

function fetchArchiveElement(indexXml) {
    let parsedXml = xml.parse(indexXml.toString(), options);

    if (parsedXml && parsedXml.archive) {
        return parsedXml.archive;
    } else {
        throw new Error(`${moduleIdentifier}#readArchiveElement: Failed to read the archive element.`);
    }

}

/**
 * @function findContentXmlNames
 *
 * Retrieves all content XML names from the toplevel archive element.
 *
 * @param {XMLNode} archiveElem
 *
 * @returns {Array}
 */
function findContentXmlNames(archiveElem) {
    let result = archiveElem['#text']
        .split('\n')
        .filter((e) => e.match(/content/))
        .map((e) => e.replace(/&|;/g, ''));

    if (!Array.isArray(result) || result.length <= 0) {
        throw new Error(`${moduleIdentifier}#findContentXmlNames: Failed to parse the content XML names from archive element.`);
    } else {
        return result;
    }
}

function fetchObjectElements(contentXmlNames) {
    return contentXmlNames
        .map(readContentXml)
        .reduce((acc, val) => acc.concat(val), []); // Concat all objects from the individual content XMLs
}

/**
 * Write the result from previous mapping stages to Elasticsearch.
 *
 * @async
 * @function persistToEs
 * @param {Object} archiveEntries
 * @param {Array} archiveEntries.done - List of successful mappings
 * @param {Array} archiveEntries.failed - List of failed mappings
 * @return {Object} Object  of successful and failed mappings
 */
async function persistToEs(archiveEntries) {
    let done = [];
    let failed = [].concat(archiveEntries.failed);

    let i = 0;
    for (const entry of archiveEntries.done) {
        console.log(`Creating ES document ${++i}/${archiveEntries.done.length} `);

        /* Remove uneccessary data before writing to ES */
        let cleanedEntry = Object.assign({}, entry);
        if (cleanedEntry._errors) {
            delete cleanedEntry._errors;
        }

        try {
            let result = await api.postJson('http://localhost:8080/archive/api/archive/invoices', cleanedEntry);

            if (result && result.success === true) {
                done.push(entry);
            } else {
                entry._errors.stage.persistToEs.push({
                    message: result.error || 'API error without message.',
                    data: result
                });
                failed.push(entry);
                console.error('Failed to persist to ES');
            }
        } catch (e) {
            entry._errors.stage.persistToEs.push({
                message: 'Failed to persist to ES with exception',
                data: e
            });
            failed.push(entry);
            console.error('Failed to persist to ES with exception: ', e, entry);
        }
    }

    return {
        done,
        failed
    };
}

async function processAttachments(archiveEntries) {
    let processor = new FileProcessor(dataDir);
    let result = await processor.parse(archiveEntries);

    return result;
}

async function doCustomerMapping(archiveEntries) {
    let mapper = new CustomerMapper(`${mappingDir}/mapping.csv`);
    let result = await mapper.run(archiveEntries);

    return result;
}

main();
