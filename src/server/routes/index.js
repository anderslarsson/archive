'use strict';

const curatorHandler = require('./api/curator/');
const infoHandler = require('./api/info/');
const indicesHandler = require('./api/indices/');

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
  // Register routes here.
  // Use the passed db parameter in order to use Epilogue auto-routes.
  // Use require in order to separate routes into multiple js files.
  app.get('/hello', async (req, res) => {
    res.send('Hello world!');
  });

  // --- Curator
  app.get('/api/curator/:period', (req, res) => curatorHandler.curate(req, res, app, db));

  // --- Info
  app.get('/api/info/cluster', (req, res) => infoHandler.getClusterHealth(req, res));

  // --- Indices
  app.get('/api/indices/:type', (req, res) => indicesHandler.listAllByType(req, res));
  app.get('/api/indices/:tenantId/:type', (req, res) => indicesHandler.listByTenantAndType(req, res));
  app.post('/api/indices/open_request', (req, res) => indicesHandler.openIndex(req, res));

  // --- Entries
  app.get('/api/entries/:tenantId/:year/:month', (req, res) => res.status(500).send('Not implemented.'));

};
