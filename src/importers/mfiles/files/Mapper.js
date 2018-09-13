'use strict';

const {InvoiceArchiveConfig} = require('../../../shared/invoice_archive_config');

class Mapper {
    constructor(objectElem) {
        this.objectElem       = objectElem;
        this.latestVersion = this._getLatestObjectVersion(this.objectElem.version);

        this.document = {};

        this.logger = console;
    }

    /**
     * @function do
     *
     * @returns {object} The resulting ES archive document
     */
    do() {
        /* Get the fields from the elasticsearch mapping definition */
        let fields = Object.keys(InvoiceArchiveConfig.esMapping.mappings._doc.properties);

        try {
            fields.forEach((field) => {
                let upper = field.replace(/^\w/, c => c.toUpperCase());

                if (typeof this[`_build${upper}`] === 'function') {
                    this.document[field] = this[`_build${upper}`]();
                } else {
                    this.logger.info(`InvoiceArchiveMapper#do: No mapper function found for field "${field}"`);
                }
            });

        } catch (e) {
            this.logger.error('InvoiceArchiveMapper#do: Failed to build invoice archive document.');
        }

        return this.document;
    }

    _buildCustomerId() {
        return 'Not implemented';
    }

    _buildEnd() {
        return this._fetchFromPropsByName('Date');
    }

    _buildFiles() {
        /*
         * Fetch the path to the EML file and store it
         * temporary to the inbound struct.
         * This will be removed after the EML
         * has been parsed and the PDFs are stored to
         * the inboundAttachments field.
         */
        let pathToEml = this.latestVersion
            .docfiles
            .docfile
            .attr['@_pathfrombase']
            .replace(/\\/g, '/');

        return {
            inbound: {
                pathToEml,
                reference: null
            },
            inboundAttachments: [],
            outbound: null,
            outboundAttachments: []
        };
    }

    _buildHistory() {
        // Nothing to do here
        return [];
    }

    _buildLastStatus() {
        return 'imported_from_mfiles';
    }

    _buildMsgType() {
        return 'invoice';
    }

    _buildMsgSubType() {
        // Nothing to do here
        return null;
    }

    _buildReceiver() {
        let mailId = this._fetchFromPropsByName('MailID');
        if (mailId && typeof mailId.toString) {
            mailId = mailId.toString();
        }

        return {
            physical: 'M-FILES',
            target: 'Not implemented',
            protocolAttributes: {
                to: this._fetchFromPropsByName('To'),
                from: this._fetchFromPropsByName('From'),
                mailId
            }
        };
    }

    _buildSender() {
        // No data will be available
        return null;
    }

    _buildStart() {
        return this._fetchFromPropsByName('Date');
    }

    /**
     * The supplier ID is unknown for data imported from M-FILES
     * @method _buildSupplierId
     * @return null
     */
    _buildSupplierId() {
        return null;
    }

    /**
     * Returns a virtual transaction ID for documents imported
     * from M-FILES based on their GUID as they are not assigned
     * to a real transaction known to the BNP.
     *
     * @method _buildTransactionId
     * @return {UUID}
     */
    _buildTransactionId() {
        return this.objectElem.attr['@_guid'].replace(/{|}/g, '');
    }

    _isEmtpyObj(obj) {
        Object.keys(obj).length === 0 && obj.constructor === Object;
    }

    _fetchFromPropsByName(name) {
        let props = this.latestVersion.properties.property;

        if (!props) {
            return null;
        }

        let value = props.find((p) => p.attr['@_name'] === name);

        if (value && value.hasOwnProperty('#text')) {
            return value['#text'];
        } else {
            return null;
        }
    }

    _getLatestObjectVersion(version) {
        if (!Array.isArray(version)) {
            return version;
        }

        return version.reduce((acc, v) => {
            return (v.attr['@_value'] >= acc.attr['@_value']) ? v : acc;
        }, version[0]);
    }


}

module.exports = Mapper;
