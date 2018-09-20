'use strict';

const fs   = require('fs');
const he   = require('he');
const xml  = require('fast-xml-parser');

// const homeDir = require('os').homedir();
// const dataDir = `${homeDir}/tmp/SIE_export`;
// const dataDir = `${homeDir}/tmp/SIE_redux`;
// const dataDir = `${homeDir}/tmp/mfiles_import`;

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

module.exports = class MfilesXmlParser {

    constructor(dataDir) {
        this.dataDir = dataDir;
    }

    run() {
        let indexXml        = this.readEntrypointXml(`${this.dataDir}/Index.xml`);
        let archiveElem     = this.fetchArchiveElement(indexXml);
        let contentXmlNames = this.findContentXmlNames(archiveElem);
        let objects         = this.fetchObjectElements(contentXmlNames);

        let result = this.removeNonEmailNodes(objects);

        return result;
    }

    fetchObjectElements(contentXmlNames) {
        return contentXmlNames
            .map(this.readContentXml.bind(this))
            .reduce((acc, val) => acc.concat(val), []); // Concat all objects from the individual content XMLs
    }

    readEntrypointXml(filePath) {
        let result;
        try {
            result = fs.readFileSync(filePath);
        } catch (e) {
            result = null;
        }

        if (result) {
            return result;
        } else {
            throw new Error(`MfilesXmlParser#readEntrypointXml: Failed to read ${filePath}`);
        }
    }

    fetchArchiveElement(indexXml) {
        let parsedXml = xml.parse(indexXml.toString(), options);

        if (parsedXml && parsedXml.archive) {
            return parsedXml.archive;
        } else {
            throw new Error('MfilesXmlParser#readArchiveElement: Failed to read the archive element.');
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
    findContentXmlNames(archiveElem) {
        let result = archiveElem['#text']
            .split('\n')
            .filter((e) => e.match(/content/))
            .map((e) => e.replace(/&|;/g, ''));

        if (!Array.isArray(result) || result.length <= 0) {
            throw new Error('MfilesXmlParser#findContentXmlNames: Failed to parse the content XML names from archive element.');
        } else {
            return result;
        }
    }

    /**
     * @function readContentXml
     *
     * Extracts the object properties from the Content.xml
     *
     * @return {Array} - List of object entries
     */
    readContentXml(entityName) {
        entityName = entityName.trim();

        let capitalizedEntityName = entityName.replace(/^\w/, c => c.toUpperCase());
        let fileName = `${this.dataDir}/Metadata/${capitalizedEntityName}.xml`;
        let contentXml = fs.readFileSync(fileName);

        console.info(`NFO: Parsing content XML: ${fileName}`);

        let content = xml.parse(contentXml.toString(), options).content;

        return content.object;
    }

    removeNonEmailNodes(objects) {
        console.log(`MfilesXmlParser#removeNonEmailNodes: Starting with ${objects.length} objects`);

        let removed = 0;
        let result = objects.filter((obj) => {
            let success = false;
            let v = this._getLatestObjectVersion(obj.version);

            if (v) {
                let klass = v.properties.property.find((prop) => prop.attr && prop.attr['@_name'] && prop.attr['@_name'] === 'Class');
                if (klass && klass['#text'] && klass['#text'] === 'Email') {
                    success = true;
                }
            }

            success === false && removed++;

            return success;
        });

        console.log(`MfilesXmlParser#removeNonEmailNodes: Finished with ${result.length} objects. Removed ${removed}`);

        return result;
    }

    _getLatestObjectVersion(version) {
        if (!Array.isArray(version)) {
            return version;
        }

        return version.reduce((acc, v) => {
            return (v.attr['@_value'] >= acc.attr['@_value']) ? v : acc;
        }, version[0]);
    }
};
