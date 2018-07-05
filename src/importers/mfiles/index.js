'use strict';

const xml = require('fast-xml-parser');
const fs  = require('fs');

const simpleParser = require('mailparse').simpleParser;

const homeDir = require('os').homedir();
const dataDir = `${homeDir}/tmp/Test-export`;

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
      .reduce((acc, val) => acc.concat(val), []); // Flatten array

    let files = objects.map(parseObjectMeta);

    let existingFiles = files
      .filter((f) => fs.existsSync(`${dataDir}/${f.path}`));

    existingFiles.forEach(async (f) => {
      console.log(f.path);

      let eml = fs.readFileSync(`${dataDir}/${f.path}`, 'utf8');

      console.log(`// ------------------- ${f.path}`);

      let mail = await simpleParser(eml);

      debugger;
    });

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
  let capitalizedEntityName = entityName.replace(/^\w/, c => c.toUpperCase());

  let contentXml = fs.readFileSync(`${dataDir}/Metadata/${capitalizedEntityName}.xml`);
  let content = xml.parse(contentXml.toString(), options).content;

  return content.object;
}

function parseObjectMeta(obj) {
  let path = obj.version.docfiles.docfile.attr['@_pathfrombase']
    .replace(/\\/g, '/');

  let props = obj.version.properties.property;
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
