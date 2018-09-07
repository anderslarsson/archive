'use strict';

const invoiceArchiveHandler     = require('./api/invoice_archive/');
const infoHandler               = require('./api/info/');
const tenantConfigHandler       = require('./api/tenantconfig/');

const {
    indicesInvoiceHandler,
    indicesCmdHandler,
    documentsHandler 
} = require('./api/indices/');

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

    let notImplementedFn = (req, res) => res.status(500).send('Not implemented.');

    /* *** TenantConfig *** */
    app.post('/api/tenantconfig', notImplementedFn);
    app.get('/api/tenantconfig/:type', (req, res) => tenantConfigHandler.get(req, res, app, db));

    /* *** Invoice archive *** */
    app.post('/api/archive/invoices', (req, res) => invoiceArchiveHandler.createDocument(req, res, app, db));

    app.post('/api/archive/invoices/job', (req, res) => invoiceArchiveHandler.createArchiverJob(req, res, app, db));

    /* *** Info *** */
    app.get('/api/info/cluster', (req, res) => infoHandler.getClusterHealth(req, res));

    /* *** Indices *** */
    app.get('/api/indices', tenantIdFilter, (req, res) => handle(req, res, app, db, indicesInvoiceHandler.get));
    app.post('/api/indices/:id/open', (req, res) => indicesCmdHandler.openIndex(req, res));
    app.get('/api/indices/:index/documents/:id', (req, res) => documentsHandler.get(req, res));

    /* *** Searches *** */
    app.post('/api/searches', (req, res) => invoiceArchiveHandler.search(req, res, app, db));
    app.get('/api/searches/:id', (req, res) => invoiceArchiveHandler.scroll(req, res, app, db));

};

function handle(req, res, app, db, handlerFn) {
    try {
        handlerFn(req, res, app, db);
    } catch (e) {
        res.json({
            success: false,
            message: e.message || 'Unknown error'
        });
    }
}

async function tenantIdFilter(req, res, next) {
    if (!req.query.tenantId) {
        res.status(400).json({
            success: false,
            message: 'No tenantId found in query.'
        });
    }

    let tenantId = req.query.tenantId;

    let allowed = false;
    let tenants = [];

    try {
        tenants = (await req.opuscapita.getUserTenants());

        let hasAll = tenants.find(t => t === '*');
        if (hasAll) {
            allowed = true;
        }

        let hasTenant = tenants.find(t => t === tenantId);
        if (hasTenant) {
            allowed = true;
        }
    } catch (e) {
        res.status(400).json({
            success: false,
            message: 'Failed to fetch user tenants.'
        });
    }

    if (allowed) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: ` Access denied for tenantId ${tenantId}`
        });
    }
}
