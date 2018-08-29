'use strict';

const invoiceArchiveHandler = require('./api/invoice_archive/');
const infoHandler           = require('./api/info/');
const indicesHandler        = require('./api/indices/');
const tenantConfigHandler   = require('./api/tenantconfig/');

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
    app.post('/api/archive/invoice/job', (req, res) => invoiceArchiveHandler.createArchiverJob(req, res, app, db));
    app.post('/api/archive/invoice', (req, res) => invoiceArchiveHandler.createDocument(req, res, app, db));

    // --- Info
    app.get('/api/info/cluster', (req, res) => infoHandler.getClusterHealth(req, res));

    // --- Indices
    app.get('/api/indices/:type', (req, res) => indicesHandler.listAllByType(req, res));
    app.get('/api/indices/:tenantId/:type', (req, res) => indicesHandler.listByTenantAndType(req, res));
    app.post('/api/indices/open_request', (req, res) => indicesHandler.openIndex(req, res));

    // --- Entries
    app.get('/api/entries/:tenantId/:year/:month', notImplementedFn);

};
