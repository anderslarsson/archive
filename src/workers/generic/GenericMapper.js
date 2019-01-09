'use strict';

const Logger = require('ocbesbn-logger');
const {InvoiceArchiveConfig} = require('../../shared/invoice_archive_config');

class GenericMapper {
    /**
     * Creates a new instance of the Mapper.
     * Sets instance variables for transactionId and transaction items.
     *
     * @constructor
     * @param {string} tenantId
     * @param {string} transactionId - The transaction that should be mapped
     * @param {array} items - List of transactions that belong to the transactionId
     */
    constructor(tenantId, transactionId, items = []) {
        if (!tenantId || !transactionId) {
            throw new Error('Missing parameters.');
        }

        this.transactionId = transactionId;
        this.items         = items || [];
        this.document      = {transactionId};
        this.owner         = tenantId;

        this.logger = new Logger({
            context: {
                serviceName: 'archive',
                transactionId: transactionId
            }
        });
    }

    /** *** GETTER *** */

    get klassName() {
        return this.constructor.name || 'GenericMapper';
    }

    /**
     * Triggers the actual mapping of the data given to the constructor.
     *
     * @function do
     * @returns {object} The resulting ES archive document
     */
    do() {
        if (this.items.length <= 0) {
            return {};
        }

        /* Get the fields from the elasticsearch mapping definition */
        let fields = Object.keys(InvoiceArchiveConfig.esMapping.mappings.doc.properties);

        try {
            fields.forEach((field) => {
                let upper = field.replace(/^\w/, c => c.toUpperCase());

                if (typeof this[`_build${upper}`] === 'function') {
                    this.document[field] = this[`_build${upper}`]();
                } else {
                    this.logger.info(this.klassName, `#do: No mapper function found for field "${field}"`);
                }
            });

        } catch (e) {
            this.logger.error('InvoiceArchiveMapper#do: Failed to build invoice archive document. Exception: ', e);
            // TODO maybe return a falsy value instead of an incomplete document?
        }

        return this.document;
    }

    _buildCustomerId() {
        return this._simpleReducer('customerId');
    }

    _buildDocument() {
        const buildFiles = () => {
            /**
             * Reduce a given list of events and return the last valid document
             * from the  inbound or outbound struct of 'event.document.files.inbound|outbound'
             *
             * @param {string} type
             * @return {object} Last inbound or outbound document from list.
             */
            const inOutBoundReducer = (type) => {
                return (acc, val) => {
                    const c = ((val.document || {}).files || {})[type] || null;

                    if (!c) return acc;

                    const isArchivable = c && (c.archivable === true || c.archivable === 'true');
                    const isBlob = c && c.refType === 'blob';
                    const isInTenantContainer = c && c.reference && c.reference.indexOf(this.owner) >= 0;

                    const isValid = isArchivable && isBlob && isInTenantContainer;

                    return isValid ? c : acc;
                };
            };

            const inbound = this.items.reduce(inOutBoundReducer('inbound'), null);
            const outbound = this.items .reduce(inOutBoundReducer('outbound'), null);

            const outboundAttachments = this.items
                .reduce((acc, val) => {
                    let attachments = ((val.document || {}).files || {}).outboundAttachments || [];
                    return acc.concat(attachments);
                }, [])
                .filter(e => e.archivable === true || e.archivable === 'true')
                .filter(e => e.refType === 'blob')
                .filter(e => e.reference && e.reference.indexOf(this.owner) >= 0);

            const inboundAttachments = this.items
                .reduce((acc, val) => {
                    let attachments = ((val.document || {}).files || {}).inboundAttachments || [];
                    return acc.concat(attachments);
                }, [])
                .filter(e => e.archivable === true || e.archivable === 'true')
                .filter(e => e.refType === 'blob')
                .filter(e => e.reference && e.reference.indexOf(this.owner) >= 0);

            const canonical = this.items.reduce((acc, val) => {
                const c = ((val.document || {}).files || {}).canonical || null;
                return c ? c : acc;
            }, null);

            return {
                inbound,
                outbound,
                canonical,
                inboundAttachments: inboundAttachments || [],
                outboundAttachments: outboundAttachments || []
            };
        };

        let buildMsgType = () => {
            return this.items.reduce((acc, elem) => {
                if (elem.document && elem.document.msgType) {
                    return elem.document.msgType;
                } else {
                    return acc;
                }
            }, null);
        };

        let buildMsgSubType = () => {
            return this.items.reduce((acc, elem) => {
                if (elem.document && elem.document.msgTypeSub) {
                    return elem.document.msgTypeSub;
                } else {
                    return acc;
                }
            }, null);
        };

        return {
            msgType: buildMsgType(),
            msgSubType: buildMsgSubType(),
            files: buildFiles()
        };
    }

    _buildEnd() {
        let lastTimestamp = (this.items[this.items.length - 1] || {}).timestamp || null;

        /**
         * FIXME should this fallback be allowed? Cause the transaction
         * ends with the last entry not with a random one.
        */
        if (lastTimestamp === null) {
            let l = lastTimestamp = this.items.find((i) => i.timestamp);
            if (l && l.timestamp) {
                lastTimestamp = l.timestamp;
            }
        }

        return lastTimestamp;
    }

    _buildExternalReference() {
        let result = this.items
            .filter(e => !this._isEmtpyObj(e.externalReference))
            .reduce((acc, e) => {
                if (e.externalReference && e.externalReference.type && e.externalReference.value) {
                    return {
                        type: e.externalReference.type,
                        value: e.externalReference.value
                    };
                } else {
                    return acc;
                }
            }, {});


        if (result.type && result.value) {
            return result;
        } else {
            return null;
        }
    }

    _buildHistory() {
        return this.items
            .map((i) => {
                return {
                    date: i.timestamp || null,
                    shortEventText: i.shortEventText || '',
                    eventText: i.eventText || '',
                    status: i.stepStatus || ''
                };
            });
    }

    _buildLastStatus() {
        let result = this.items.reduce((acc, elem) => {
            return elem.hasOwnProperty('stepStatus') ? elem.stepStatus : acc;
        }, null);

        return result;
    }

    _buildReceiver() {
        let receiver = this.items
            .map((i) => i.receiver || null)
            .filter(r => r !== null)
            .filter(r => typeof r === 'object')
            .map(r => {
                if (r.hasOwnProperty('protocolAttributes') && typeof r.protocolAttributes === 'object') {
                    return r;
                } else {
                    return Object.assign(r, {protocolAttributes: {}}); // Make it schema valid
                }
            })
            .reduce((acc, elem) => Object.assign(acc, elem) , {});

        return this._isEmtpyObj(receiver) ? null : receiver;
    }

    _buildSender() {
        let sender = this.items
            .map((i) => i.sender || null)
            .filter((s) => s !== null)
            .filter(r => typeof r === 'object')
            .map(r => {
                if (r.hasOwnProperty('protocolAttributes') && typeof r.protocolAttributes === 'object') {
                    return r;
                } else {
                    return Object.assign(r, {protocolAttributes: {}}); // Make it schema valid
                }
            })
            .reduce((acc, elem) => Object.assign(acc, elem) , {});

        return this._isEmtpyObj(sender) ? null : sender;
    }

    _buildStart() {
        let firstTimestamp = this.items.find((i) => i.timestamp);
        return firstTimestamp && firstTimestamp.timestamp;
    }

    _buildSupplierId() {
        return this._simpleReducer('supplierId');
    }

    _buildTransactionId() {
        return this.transactionId;
    }

    _simpleReducer(fieldName) {
        return this.items.reduce((acc, elem) => {
            return elem.hasOwnProperty(fieldName) ? elem[fieldName] : acc;
        }, null);
    }

    _isEmtpyObj(obj) {
        if (!obj) return true;

        Object.keys(obj).length === 0 && obj.constructor === Object;
    }

}

module.exports = GenericMapper;
