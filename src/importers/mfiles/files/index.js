'use strict';

const fs   = require('fs');
const args = require('minimist')(process.argv.slice(2));

const MfilesXmlParser = require('./MfilesXmlParser');
const EsUploader      = require('./EsUploader');
const Mapper          = require('./Mapper');
const FileProcessor   = require('./FileProcessor');
const api             = require('./Api');
const CustomerMapper  = require('./CustomerMapper');

const homeDir = require('os').homedir();
// const dataDir = `${homeDir}/tmp/SIE_export`;
// const dataDir = `${homeDir}/tmp/SIE_redux`;
const dataDir = `${homeDir}/tmp/mfiles_import`;
const mappingDir = `${homeDir}/tmp`;

let resumeFrom = null;

async function main() {
    let archiveEntriesStage1, archiveEntriesStage2, archiveEntriesStage3, archiveEntriesStage4;

    if (args.resume) {
        let content = fs.readFileSync(args.resume);
        resumeFrom = JSON.parse(content);
    }

    try {
        /* STAGE 1: Preprocessing, fetching all object elemaents from content XML */

        console.log('--- STAGE 1 ---');

        archiveEntriesStage1  = preprocessXml();

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

        await api.init();

        archiveEntriesStage4 = await processAttachments(archiveEntriesStage3);

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

function preprocessXml() {
    let parser = new MfilesXmlParser();
    let result = parser.run();

    return result;
}

function parseObjectMeta(obj) {
    let mapper = new Mapper(obj);
    let result = mapper.do();

    return result;
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
    const esUploader = new EsUploader();
    let result = await esUploader.run(archiveEntries);

    esUploader.dispose();

    return result;
}

async function processAttachments(archiveEntries) {
    let processor = new FileProcessor(dataDir);
    let result = await processor.run(archiveEntries);

    processor.dispose();

    return result;
}

async function doCustomerMapping(archiveEntries) {
    let mapper = new CustomerMapper(`${mappingDir}/mapping.csv`);
    let result = await mapper.run(archiveEntries);

    return result;
}

main();
