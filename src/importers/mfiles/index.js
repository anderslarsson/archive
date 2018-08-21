'use strict';

const xml = require('fast-xml-parser');
const fs  = require('fs');

const simpleParser = require('mailparse').simpleParser;

const homeDir = require('os').homedir();
const dataDir = `${homeDir}/tmp/SIE_export`;

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
      .reduce((acc, val) => acc.concat(val), []); // Flatten array

    let files = objects.map(parseObjectMeta);

    let existingFiles = files
      .filter((f) => fs.existsSync(`${dataDir}/${f.path}`));

    // console.info('[INFO] No. of files missing: ' + (files.length - existingFiles.length));

    let t = [];
    for (const f of existingFiles) {
      let eml = fs.readFileSync(`${dataDir}/${f.path}`, 'utf8');

      // console.log(`// ------------------- ${f.path}`);

      let mail = await simpleParser(eml);

      if (mail) {
        if (mail.attachments) {
          t.push([f.path, mail.attachments.length]);
        } else {
          t.push([f.path, 'NOTHING']);
        }

      } else {
        t.push([f.path, 'PARSING ERROR']);
      }
    }

    for (const entry of t) {
      console.log(entry[0], ',', entry[1]);
    }
    // TODO
    // - get email text from eml for ES indexing
    // - put file to blob storage
    // - create archive entry
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
  // TODO Implement reading all versions

  let docIsVersioned = Array.isArray(obj.version);

  // if (docIsVersioned) {
  //   debugger;
  // }

  let latestVersion =  docIsVersioned ? obj.version.pop() : obj.version;

  let path = latestVersion.docfiles.docfile.attr['@_pathfrombase']
    .replace(/\\/g, '/');

  let props = latestVersion.properties.property;
  let from = props
    .find((p) => p.attr['@_name'] === 'From') // TODO assert only one name property in XML
    ['#text'];

  return {
    path,
    metadata: {
      from
    }
  };
}

main();
