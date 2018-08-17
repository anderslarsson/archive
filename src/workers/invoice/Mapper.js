'use strict';

const Logger = require('ocbesbn-logger');
const {InvoiceArchiveConfig} = require('../../shared/invoice_archive_config');

class Mapper {
    constructor(transactionId, items) {
        this.items = items || [];

        this.transactionId = transactionId;
        this.document = {};

        this.logger = new Logger({
            context: {
                serviceName: 'archive',
                transactionId: transactionId
            }
        });
    }

    /**
     * @function do
     *
     * description
     *
     * @returns {object} The resulting ES archive document
     */
    do() {
        if (this.items.length <= 0) {
            return {};
        }

        /* Get the fields from the elasticsearch mapping definition */
        let fields = Object.keys(InvoiceArchiveConfig.esMapping.mappings._doc.properties);

        try {
            this.document.tenantId = this._buildOwner();

            fields.forEach((field) => {
                let upper = field.replace(/^\w/, c => c.toUpperCase());

                if (typeof this[`_build${upper}`] === 'function') {
                    this.document[field] = this[`_build${upper}`]();
                } else {
                    this.logger.info(`InvoiceArchiveMapper#do: No mapper function found for field "${field}"`);
                }
            });

        } catch (e) {
            /* handle error */
            this.logger.error('InvoiceArchiveMapper#do: Failed to build invoice archive document.');
        }

        return this.document;
    }

    _buildCustomerId() {
        return this._simpleReducer('customerId');
    }

    _buildEnd() {
        let lastTimestamp = this.items[this.items.length - 1].timestamp || null;

        if (lastTimestamp === null) {
            let l = lastTimestamp = this.items
                .find((i) => i.timestamp);
            if (l) {
                lastTimestamp = l.timestamp;
            }
        }

        return lastTimestamp;
    }

    _buildFiles() {
        return {
            inbound: 'Not implemented',
            inboundAttachments: 'Not implemented',
            outbound: 'Not implemented',
            outboundAttachments: 'Not implemented'
        };
    }

    _buildHistory() {
        return this.items
            .map((i) => {
                return {
                    date: i.timestamp || null,
                    description: i.eventText || '',
                    status: i.processStatus || ''
                };
            });
    }

    _buildLastStatus() {
        let result = this.items.reduce((acc, elem) => {
            return elem.hasOwnProperty('processStatus') ? elem.processStatus : acc;
        }, null);

        return result;
    }

    _buildMsgType() {
        return this.items.reduce((acc, elem) => {
            if (elem.document && elem.document.msgtype) {
                return elem.document.msgtype;
            } else {
                return acc;
            }
        }, null);
    }

    _buildMsgSubType() {
        return this.items.reduce((acc, elem) => {
            if (elem.document && elem.document.msgtypeSub) {
                return elem.document.msgtypeSub;
            } else {
                return acc;
            }
        }, null);
    }

    _buildOwner() {
        let owner = null;

        let tOwners = this.items
            .map((h) => {
                if (h.customerId) {
                    if (h.receiver && h.receiver.target && h.receiver.target === h.customerId) {
                        // Invoice receiving
                        return `c_${h.customerId}`;
                    }
                }

                if (h.supplierId) {
                    if (h.receiver && h.receiver.target && h.receiver.target === h.supplierId) {
                        // Invoice sending
                        return `s_${h.supplierId}`;
                    }
                }

                return null;
            })
            .filter((o) => o !== null)
            .filter((el, i, a) => i === a.indexOf(el));

        if (tOwners.length !== 1) {
            // Inform Sirius about failure state. TODO
            this.logger.error('InvoiceArchiveMapper#_buildOwner: Multiple possible owners found.', tOwners);
            throw new Error('Unable to detect owning tenantId');
        } else {
            owner = tOwners[0];
        }

        return owner;
    }

    _buildReceiver() {
        let receiver = this.items
            .map((i) => i.receiver || null)
            .filter((r) => r !== null)
            .reduce((acc, elem) => Object.assign(acc, elem) , {});

        return this._isEmtpyObj(receiver) ? null : receiver;
    }

    _buildSender() {
        let sender = this.items
            .map((i) => i.sender || null)
            .filter((s) => s !== null)
            .reduce((acc, elem) => Object.assign(acc, elem) , {});

        return this._isEmtpyObj(sender) ? null : sender;
    }

    _buildStart() {
        let firstTimestamp = this.items.find((i) => i.timestamp);

        return firstTimestamp.timestamp;
    }

    _buildSupplierId() {
        return this._simpleReducer('supplierId');
    }

    _simpleReducer(fieldName) {
        return this.items.reduce((acc, elem) => {
            return elem.hasOwnProperty(fieldName) ? elem[fieldName] : acc;
        }, null);
    }

    _isEmtpyObj(obj) {
        Object.keys(obj).length === 0 && obj.constructor === Object;
    }

}

module.exports = Mapper;