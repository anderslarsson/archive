'use strict';

const xml = require('fast-xml-parser');
const fs  = require('fs');
const simpleParser = require('mailparse').simpleParser;

const Mapper = require('./Mapper');

const homeDir = require('os').homedir();
const dataDir = `${homeDir}/tmp/SIE_export`;

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
    localeRange: '', //To support non english character in tag/attribute values.
};

async function main() {

    try {

        /* Stage 1: Preprocessing */

        let indexXml        = readEntrypointXml(`${dataDir}/Index.xml`);
        let archiveElem     = fetchArchiveElement(indexXml);
        let contentXmlNames = findContentXmlNames(archiveElem);
        let objectElements  = fetchObjectElements(contentXmlNames);

        /* Stage 2: Create mapping */

        let files = objectElements.map(parseObjectMeta);

        let existingFiles = files
            .filter((f) => fs.existsSync(`${dataDir}/${f.path}`));

        // console.info('[INFO] No. of files missing: ' + (files.length - existingFiles.length));

        /* Stage 3: Fetch owner information (tenantId) */
        
        // TODO Not yet decided how to do the mapping.

        /* Stage 4: Parse EML files, upload extracted files to blob */

        let result = [];
        for (const f of existingFiles) {
            // let eml = fs.readFileSync(`${dataDir}/${f.path}`, 'utf8');

            // let mail = await simpleParser(eml);
            let mail = null;

            if (mail) {
                result.push(Object.assign(f, {parsedEml: mail}));
            } else {
                result.push(Object.assign(f, {parsedEml: {attachments: []}}));
            }

        }

        /* Stage 5: Store in ES */

        for (const entry of result) {
            if (entry && entry.parsedEml && entry.parsedEml.attachments) {
                console.log(`${entry.metadata.from},${entry.metadata.to},${entry.path},${entry.parsedEml.attachments.length}`);
            }
        }

    } catch (e) {
        console.log(e);
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

    let contentXml = fs.readFileSync(`${dataDir}/Metadata/${capitalizedEntityName}.xml`);
    let content = xml.parse(contentXml.toString(), options).content;

    return content.object;
}

function parseObjectMeta(obj) {
    let mapper = new Mapper(obj);
    let result = mapper.do();

    return result;
}

function readEntrypointXml(path) {
    let result;
    try {
        result = fs.readFileSync(path);
    } catch (e) {
        result = null;
    }

    if (result) {
        return result;
    } else {
        throw new Error(`${moduleIdentifier}#readEntrypointXml: Failed to read ${path}`);
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

main();
