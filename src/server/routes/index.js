/**
 * Route definitions
 */

'use strict';

const invoiceArchiveHandler     = require('./api/invoice_archive/');
const invoiceCuratorHandler     = require('./api/curator/invoice');
const tenantConfigHandler       = require('./api/tenantconfig/');
const archiveJobsHandler        = require('./api/archive/jobs');
const searchHandler             = require('./api/search/search');

const {
    indicesInvoiceHandler,
    indicesCmdHandler,
    documentsHandler
} = require('./api/indices/');

const can = require('./api/can');

/**
 * Initializes all routes for RESTful access.
 *
 * @param {object} app - [Express]{@link https://github.com/expressjs/express} instance.
 * @param {object} db - If passed by the web server initialization, a [Sequelize]{@link https://github.com/sequelize/sequelize} instance.
 * @param {object} config - Everything from [config.routes]{@link https://github.com/OpusCapita/web-init} passed when running the web server initialization.
 * @returns {Promise} JavaScript Promise object.
 * @see [Minimum setup]{@link https://github.com/OpusCapita/web-init#minimum-setup}
 */
module.exports.init = async function (app, db) {

    // let notImplementedFn = (req, res) => res.status(500).send('Not implemented.');

    /** *** TenantConfig *** */
    app.post('/api/tenantconfig', (req, res) => tenantConfigHandler.post(req, res, app, db));
    app.get('/api/tenantconfig/:type', (req, res) => tenantConfigHandler.get(req, res, app, db));

    /** *** Invoice archive *** */
    app.post('/api/archive/invoices', (req, res) => invoiceArchiveHandler.createDocument(req, res, app, db));

    /** *** Generic archive *** */
    app.post('/api/archive/jobs/:type', (req, res) => handle(req, res, app, db, archiveJobsHandler.create));

    /** *** Indices *** */
    app.get('/api/indices', can.listInvoiceIndicesByTenantId, (req, res) => handle(req, res, app, db, indicesInvoiceHandler.get));
    app.post('/api/indices/:index/open', can.accessIndex, (req, res) => handle(req, res, app, db, indicesCmdHandler.openIndex));
    app.get('/api/indices/:index/documents/:id', can.accessIndex, (req, res) => documentsHandler.get(req, res));

    /** *** Searches *** */
    app.post('/api/searches', can.accessIndex, (req, res) => searchHandler.search(req, res, app, db));
    app.get('/api/searches/:id', (req, res) => searchHandler.scroll(req, res, app, db));
    app.delete('/api/searches/:id', (req, res) => searchHandler.clearScroll(req, res, app, db));

    /** *** Ping *** */
    app.get(['/api/ping', '/public/api/ping'], (req, res) => res.status(200).json({success: true, data: 'pong'}));

    /** *** Curator *** */
    app.get('/public/api/curator/invoice/check', (req, res) => invoiceCuratorHandler.checkTransactionLog(req, res));

};

async function handle(req, res, app, db, handlerFn) {
    try {
        await handlerFn(req, res, app, db);
    } catch (e) {
        res.status(e.httpCode || 400).json({
            success: false,
            message: e.message || 'Unknown error'
        });
    }
}

