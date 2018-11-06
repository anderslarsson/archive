'use strict';

/**
 * InvoiceArchive API handlers
 */

const Logger                 = require('ocbesbn-logger');
const lastDayOfYear          = require('date-fns/last_day_of_year');
const elasticContext         = require('../../../../shared/elasticsearch');
const invoiceArchiveContext  = require('../../../invoice_archive');
const MsgTypes               = require('../../../../shared/msg_types');
const {InvoiceArchiveConfig} = require('../../../../shared/invoice_archive_config');
const Mapper                 = require('../../../../workers/invoice/Mapper');


const logger = new Logger({
    context: {
        serviceName: 'archive'
    }
});

/**
 * This API is called by external systems that want to trigger the archiving of a
 * a specific transaction.
 *
 * @function createArchiverJob
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {String} req.body.transactionId - ID of the transaction to archive
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.createArchiverJob = async function (req, res) {
    let transactionId = ((req || {}).body || {}).transactionId || null;

    if (!transactionId) {
        res.status(422).json({
            success: false,
            message: 'Param transactionId missing.'
        });
        return false;
    }

    try {

        /**
         * TODO Initial logging deactivated as it conflicts with logging in #createDocument
         * endpoint. Figure out, how to do this without conflict.
         */
        // const continueProcessing = await createInitialArchiveTransactionLogEntry(transactionId, db);
        const continueProcessing = true;

        if (continueProcessing === true) {
            /* Transaction not processed yet, continue */

            await invoiceArchiveContext.archiveTransaction(transactionId);
            res.status(202).json({success: true});
        } else {
            req.opuscapita.logger.warn('Trying to archive a transaction that was already processed.');
            res.status(409).json({success: false, message: 'Transaction already processed'});
        }

    } catch (e) {
        req.opuscapita.logger.error('Failed to start archiving of invoice transaction.', e);

        res.status(500).json({
            success: false,
            message: e.message || 'Unknown error'
        });
    }
};

/**
 * @function createCuratorJob
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
        req.opuscapita.logger.error('Failure in invoiceArchive API handler.', e);
        res.status(500).send(e);
    }
};

/**
 * This endpoint accepts transcation and archive documents and
 * tries to insert them to elasticsearch.
 *
 * TODO
 *   - split flow for transaction and archive payloads to different methods
 *
 * @function createDocument
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.createDocument = async function (req, res, app, db) {
    logger && logger.info('InvoiceArchiveHandler#createDocument: Creating new document from req: ', req.body);

    const isUpdate = req.query.update ? true : false; // Check if we should update document instead of insert it.

    let doc = req.body;
    let docIsMapped = false;

    if (doc && doc.hasOwnProperty('event') && typeof doc.event === 'object') {
        /** Convert transaction document to archive document first */
        doc = mapTransactionToEvent(doc);
        docIsMapped = true;
    }

    logger && logger.info('InvoiceArchiveHandler#createDocument: Starting to process document: ', doc);

    /** Basic param checking */
    if (!doc.transactionId || (!doc.supplierId && !doc.customerId) || !doc.document.msgType || doc.document.msgType !== 'invoice') {
        res.status(422).send({
            success: false,
            error: 'Required values missing or wrong msgType. Expected to find transactionId, supplierId|customerId and msgType=invoice.'
        });
        return false;
    }

    /**
     * Log process start only after basic validity check.
     *
     * TODO Use return value from call to createInitialArchiveTransactionLogEntry to determine
     *      if we should continue processing the document.
     */
    const shouldContinue = await createInitialArchiveTransactionLogEntry(doc.transactionId, db);
    logger && logger.info('Call to createInitialArchiveTransactionLogEntry returned with value: ', shouldContinue);

    /** Extract owner and type information from document */
    const transactionId = doc.transactionId;
    const tenantId      = extractOwnerFromDocument(doc);
    const type          = extractTypeFromDocument(doc);

    if (tenantId === null ||  type === null) {
        await updateArchiveTransactionLog(transactionId, 'status', 'failed');
        res.status(422).send({
            success: false,
            error: 'Unable to extract owning tenantId or archive type from document.'
        });
        return false;
    }

    /** Check if tenant has archiving enabled */
    let tHasArchiving = await hasArchiving(tenantId, type, db);
    if (!tHasArchiving) {
        await updateArchiveTransactionLog(transactionId, 'status', 'failed');
        res.status(400).send({
            success: false,
            error: `Tenant ${tenantId} is not configured for archiving.`
        });
        return false;
    }

    let success, msg;
    try {
        ({success, msg} = await insertInvoiceArchiveDocument(doc, isUpdate));
    } catch (e) {
        success = false;
        msg = 'Failed to insert archive document to elasticsearch';

        logger && logger.error('InvoiceArchiveHandler#archiveTransaction: ', msg, e);
    }

    if (success) {
        if (docIsMapped) {
            /**
             * TODO Do sth with result
             * TODO Remove as soon as M-Files imports to prod are done, readonly is set by importer
             */
            await setReadonly((((doc || {}).document || {}).files || {}).inboundAttachments || [], req);
        }

        await updateArchiveTransactionLog(doc.transactionId, 'status', 'done', db);

        res.status(200).json({
            success: true,
            message: msg || `Successfully created archive document for ${transactionId}.`
        });

    } else {
        await updateArchiveTransactionLog(doc.transactionId, 'status', 'failed', db);

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

    /* TODO add query.{year, to, from} validation */

    let queryOptions = {
        query: {
            bool: {
                must: {
                    match: {
                        '_all': {
                            query: query.fullText || '',
                            operator: 'and',
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

        const firstOfJanuar = new Date(query.year);

        if (query.from) {
            queryOptions.query.bool.filter.bool.must.push({
                range: {
                    start: {
                        gte: query.from,
                        lte: query.to || lastDayOfYear(new Date(query.year))
                    }
                }
            });
        }
        if (query.to) {
            queryOptions.query.bool.filter.bool.must.push({
                range: {
                    end: {
                        gte: query.from || firstOfJanuar.toISOString(),
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
        req.opuscapita.logger.error('InvoiceArchiveHandler#search: Failed to query ES.', e);
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
        logger && logger.error('InvoiceArchiveHandler#scroll: Failed to scroll with exception.', e);
        res.status(400).json({success: false});
    }
};

/**
 * Delete a scroll for by the given scrollId
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
module.exports.clearScroll = async function clearScroll(req, res) {
    const scrollId = req.params.id;
    const es = elasticContext.client;

    try {
        await es.clearScroll({
            scrollId
        });

        res.status(200).json({
            success: true,
            message: 'Cleared scroll successfully.'
        });

    } catch (e) {
        logger && logger.error('InvoiceArchiveHandler#clearScroll: Failed to scroll with exception.', e);
        res.status(400).json({success: false});
    }
};

/**
 * Log the start of invoice archive processing to database.
 *
 * TODO refactor function name, not very intuitive
 *
 * @async
 * @function createInitialArchiveTransactionLogEntry
 * @param {string} transactionId
 * @param {Sequelize} db - Database instance
 * @return {Boolean} Returns a boolean indicating if the caller might continueing processing of the document
 */
async function createInitialArchiveTransactionLogEntry(transactionId, db) {
    let allowProcessing = false;

    try {
        const ArchiveTransactionLog = await db.modelManager.getModel('ArchiveTransactionLog');

        let [log, created] = await ArchiveTransactionLog.findOrCreate({
            where: {
                transactionId: transactionId,
                type: 'invoice_receiving'
            },
            defaults: {
                type: 'invoice_receiving'
            }
        });

        if (created) {
            allowProcessing = true;
        } else {
            if (log.get('status' === 'failed')) {
                allowProcessing = true;
            } else {
                allowProcessing = false;
            }
        }

    } catch (e) {
        allowProcessing = false;
        logger && logger.error('InvoiceArchiveHandler#createInitialArchiveTransactionLogEntry: Failed to log start of processing to db, ', transactionId, e);
    }

    return allowProcessing;
}

/**
 * Extract the owner information from a archive document.
 *
 * @function
 * @params {object} doc
 * @returns {String} tenantId
 */
function extractOwnerFromDocument(doc) {
    if (doc.customerId) {
        if (doc.receiver && doc.receiver.target && doc.receiver.target === `c_${doc.customerId}`) {
            // Invoice receiving
            return `c_${doc.customerId}`;
        }
    }

    if (doc.supplierId) {
        if (doc.receiver && doc.receiver.target && doc.receiver.target === `s_${doc.supplierId}`) {
            // Invoice sending
            return `s_${doc.supplierId}`;
        }
    }

    return null;
}

/**
 * Detect the archive type by matching the sender/receiver information
 * with the customer/supplier info from the document.
 *
 * @function extractTypeFromDocument
 * @params {object} doc
 * @returns {String} tenantId
 */
function extractTypeFromDocument(doc) {
    if (doc.customerId) {
        if (doc.receiver && doc.receiver.target && doc.receiver.target === `c_${doc.customerId}`) {
            return 'invoice_receiving';
        }
    }

    if (doc.supplierId) {
        if (doc.receiver && doc.receiver.target && doc.receiver.target === `s_${doc.supplierId}`) {
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

/**
 * Insert a archive document to elasticsearch.
 *
 * @async
 * @function insertInvoiceArchiveDocument
 * @param {object} document - The document to insert. Needs to be in the correct format.
 * @param {boolean} [isUpdate=false] - Indicates wether the document should be created or updated.
 */
async function insertInvoiceArchiveDocument(doc, isUpdate = false) {
    const tenantId = extractOwnerFromDocument(doc);
    const archiveName = InvoiceArchiveConfig.yearlyTenantArchiveName(tenantId, doc.end);

    let msg, success;
    try {
        /* Open existing index or create new with mapping */
        let indexOpened = await elasticContext.openIndex(archiveName, true, {
            mapping: elasticContext.InvoiceArchiveConfig.esMapping
        });

        if (indexOpened) {
            let createResult = null;

            // const clientFn = isUpdate ? elasticContext.client.update : elasticContext.client.create;

            try {
                if (isUpdate) {
                    createResult = await elasticContext.client.update({
                        index: archiveName,
                        id: doc.transactionId,
                        type: elasticContext.defaultDocType,
                        // doc_as_upsert: true,
                        body: {
                            doc
                        }
                    });
                } else {
                    createResult = await elasticContext.client.create({
                        index: archiveName,
                        id: doc.transactionId,
                        type: elasticContext.defaultDocType,
                        body: doc
                    });
                }

                if (createResult && ['created', 'updated', 'noop'].includes(createResult.result)) {
                    success = true;
                    msg = `Successfully created archive document for ${doc.transactionId}.`;
                } else {
                    success = false;
                    msg = `Failed to create archive document in ${archiveName}. (TX id: ${doc.transactionId})`;
                }
            } catch (e) {
                if (e && e.body && e.body.error && e.body.error.type && e.body.error.type === 'version_conflict_engine_exception') {
                    success =  false;
                    msg     = `Version conflict! Transaction has already been written to index  ${archiveName}. (TX id: ${doc.transactionId})`;

                    logger.error('InvoiceArchiver#archiveTransaction:', msg, e);
                } else {
                    success = false;
                    msg     = `Failed to create archive document in ${archiveName}. (TX id: ${doc.transactionId})`;

                    logger.error('InvoiceArchiver#archiveTransaction: ', msg, e);
                }
            }
        }
    } catch (e) {
        success = false;
        msg     = `Unable to open index ${archiveName}. (TX id: ${doc.transactionId})`;

        logger && logger.error('InvoiceArchiver#archiveTransaction: ', msg, e);
    }

    return {success, msg};
}

function mapTransactionToEvent(doc) {
    let mapper = new Mapper(doc.event.transactionId, [doc.event]);
    let archiveDocument = mapper.do();

    return archiveDocument;
};
module.exports.mapTransactionToEvent = mapTransactionToEvent;


async function setReadonly(attachments = [], req) {
    let done   = [];
    let failed = [];

    for (const attachment of attachments) {
        try {
            const blobPath = `/api${attachment.reference}`.replace('/data/private', '/data/metadata/private');
            let result = await req.opuscapita.serviceClient.patch('blob', blobPath, {readOnly: true}, true);
            done.push(result);
        } catch (e) {
            logger && logger.error('InvoiceArchiveHandler#setReadonly: Failed to set readonly flag on attachment. ', attachment.reference, e);
            failed.push(attachment);
        }
    }

    return {done, failed};
};

async function updateArchiveTransactionLog(transactionId, key, value, db) {
    let success = false;
    try {
        const ArchiveTransactionLog = await db.modelManager.getModel('ArchiveTransactionLog');
        let logEntry = await ArchiveTransactionLog.find({where: {transactionId: transactionId}});

        if (logEntry) {
            await logEntry.set(key, value);
            await logEntry.save();

            success = true;
        }
    } catch (e) {
        logger && logger.error(`Failed to update ArchiveTransactionLog entry for transactionId ${transactionId} with key ${key} and value ${value}.`, e);
        success = false;
    }
    return success;
}
