'use strict';

/**
 * InvoiceArchive API handlers
 */

const elasticContext = require('../../../../shared/elasticsearch');
const invoiceArchiveContext = require('../../../invoice_archive');
const MsgTypes = require('../../../../shared/msg_types');
const {InvoiceArchiveConfig} = require('../../../../shared/invoice_archive_config');

/**
 * @function createArchiverJob
 *
 * This API is called by external systems that want to trigger the archiving of a
 * a specific transaction.
 *
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {String} req.body.transactionId - ID of the transaction to archive
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.createArchiverJob = async function (req, res) {
    let transactionId = req && req.body && req.body.transactionId;

    try {
        await invoiceArchiveContext.archiveTransaction(transactionId);

        res.status(200).send({success: 'true'});
    } catch (e) {
        /* handle error */
        res.status(500).send(e);
    }
};

/**
 * @function createCuratorJob
 *
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {String} req.body.period - Identifies the period that should be curated
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.createCuratorJob = async function (req, res, app, db) {
    let period = req && req.body && req.body.period;

    try {
        switch (period) {
            case MsgTypes.CREATE_GLOBAL_DAILY:
                res.status(200).send(await invoiceArchiveContext.rotateGlobalDaily());
                break;

            case MsgTypes.UPDATE_TENANT_MONTHLY:
                res.send(await invoiceArchiveContext.rotateTenantsDaily(db));
                break;

            case MsgTypes.UPDATE_TENANT_YEARLY:
                res.send(await invoiceArchiveContext.rotateTenantsMonthly(db));
                break;

            default:
                res.status(400).send(`Invalid value for paramater period: ${period}`);
        }
    } catch (e) {
        req.opuscapita.logger.error('Failure in invoiceArchive API handler.');
        res.status(500).send(e);
    }
};

/**
 * @function createDocument
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.createDocument = async function (req, res, app, db) {
    /* Check if tenant has archiving enabled */
    /* Basic param checking */
    /* ES insertion */

    let doc = req.body;

    if (!doc.transactionId || (!doc.supplierId && !doc.customerId) || !doc.msgType || doc.msgType !== 'invoice') {
        res.status(422).send({
            success: false,
            error: 'Invalid data'
        });
        return false;
    }

    let tenantId = extractOwnerFromDocument(doc);
    let type = extractTypeFromDocument(doc);

    if (tenantId === null ||  type === null) {
        res.status(422).send({
            success: false,
            error: 'Invalid data'
        });
        return false;
    }

    let tHasArchiving = await hasArchiving(tenantId, type, db);
    if (!tHasArchiving) {
        res.status(400).send({
            success: false,
            error: `Tenant ${tenantId} is not configured for archiving.`
        });
        return false;
    }

    // FIXME Check date of doc to find the target index instead of using the current month. This
    // is needed for M-Files import of existing data. So for example a doc with timestamp 2017-09-28
    // needs to be put to the yearly index not to the current monthly index.
    let archiveName = InvoiceArchiveConfig.yearlyTenantArchiveName(tenantId, doc.end);

    let msg, success;
    try {
        /* Open existing index or create new with mapping */
        let indexOpened = await elasticContext.openIndex(archiveName, true, {mapping: elasticContext.esMapping});

        if (indexOpened) {
            let createResult;

            try {
                createResult = await elasticContext.client.create({
                    index: archiveName,
                    id: doc.transactionId,
                    type: elasticContext.defaultDocType,
                    body: doc
                });

                if (createResult) {
                    success = true;
                }
            } catch (e) {
                if (e && e.body && e.body.error && e.body.error.type && e.body.error.type === 'version_conflict_engine_exception') {
                    msg = `InvoiceArchiver#archiveTransaction: Transaction has already been written to index  ${archiveName}. (TX id: ${doc.transactionId})`;
                    req.opuscapita.logger.error(msg, e);
                    success =  true; // FIXME
                } else {
                    msg = `InvoiceArchiver#archiveTransaction: Failed to create archive document in ${archiveName}. (TX id: ${doc.transactionId})`;
                    req.opuscapita.logger.error(msg, e);
                    success = false;
                }
            }
        }
    } catch (e) {
        req.opuscapita.logger.error(`InvoiceArchiver#archiveTransaction: Unable to open index ${archiveName}. (TX id: ${doc.transactionId})`, e);
    }

    if (success) {
        res.status(200).json({
            success: true
        });
    } else {
        res.status(400).json({
            success: false,
            error: msg || 'Failed to write document.'
        });
    }

    return success;
};

/**
 * Search in a given index
 *
 * @async
 * @function search
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {String} req.body.transactionId - ID of the transaction to archive
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.search = async function search(req, res) {
    let index = req.query.index;
    let {query, pageSize} = req.body;

    let es = elasticContext.client;

    let queryOptions = {
        query: {
            bool: {
                must: {
                    match: {
                        '_all': {
                            query: query.fullText || '',
                            'zero_terms_query': 'all'
                        }

                    }
                }
            }
        }
    };

    if (query.from || query.to) {
        queryOptions.query.bool.filter = {
            bool: {
                must: []
            }
        };

        if (query.from) {
            queryOptions.query.bool.filter.bool.must.push({
                range: {
                    start: {
                        gte: query.from,
                        lte: query.to
                    }
                }
            });
        }
        if (query.to) {
            queryOptions.query.bool.filter.bool.must.push({
                range: {
                    end: {
                        gte: query.from,
                        lte: query.to
                    }
                }
            });
        }

    }

    try {
        let result = await es.search({
            index,
            body: queryOptions,
            size: pageSize,
            scroll: '30m'
        });

        res.status(200).json({
            success: true,
            data: {
                hits: result.hits,
                scrollId: result._scroll_id
            }
        });

    } catch (e) {
        res.status(400).json({success: false});
    }
};

/**
 * Scroll for a given scrollId
 *
 * @async
 * @function search
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {String} req.body.scrollId - ID of the scroll API
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.scroll = async function scroll(req, res) {
    let scrollId = req.params.id;

    let es = elasticContext.client;

    try {
        let result = await es.scroll({
            scrollId,
            scroll: '30m'
        });

        res.status(200).json({
            success: true,
            data: {
                hits: result.hits,
                scrollId: result._scroll_id
            }
        });

    } catch (e) {
        res.status(400).json({success: false});
    }
};

/**
 * Extract the owner information from a archive document.
 *
 * @function
 * @params {object} doc
 * @returns {String} tenantId
 */
function extractOwnerFromDocument(doc) {
    if (doc.customerId) {
        if (doc.receiver && doc.receiver.target && doc.receiver.target === doc.customerId) {
            // Invoice receiving
            return `c_${doc.customerId}`;
        }
    }

    if (doc.supplierId) {
        if (doc.receiver && doc.receiver.target && doc.receiver.target === doc.supplierId) {
            // Invoice sending
            return `s_${doc.supplierId}`;
        }
    }

    return null;
}

/**
 * @function extractTypeFromDocument
 *
 * Extract the owner information from a archive document.
 *
 * @params {object} doc
 *
 * @returns {String} tenantId
 */
function extractTypeFromDocument(doc) {
    if (doc.customerId) {
        if (doc.receiver && doc.receiver.target && doc.receiver.target === doc.customerId) {
            return 'invoice_receiving';
        }
    }

    if (doc.supplierId) {
        if (doc.receiver && doc.receiver.target && doc.receiver.target === doc.supplierId) {
            return 'invoice_sending';
        }
    }

    return null;
}

/**
 * @function hasArchiving
 *
 * @param {String} tenantId
 * @param {String} tyoe
 *
 * @return {Boolean}
 */
async function hasArchiving(tenantId, type, db) {
    try {
        let tenantConfigModel;
        let tenantConfig;

        /* Check if owning tenantId has valid archive configuration */
        tenantConfigModel = await db.modelManager.getModel('TenantConfig');
        tenantConfig = await tenantConfigModel.findOne({
            where: {
                tenantId: tenantId,
                type
            }
        });

        return tenantConfig !== null;
    } catch (e) {
        return false;
    }
}
