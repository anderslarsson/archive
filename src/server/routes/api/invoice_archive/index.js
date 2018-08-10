'use strict';

/**
 * InvoiceArchive API handlers
 */

const invoiceArchiveContext = require('../../../invoice_archive');
const MsgTypes = require('../../../../shared/msg_types');

/**
 * Handles requests to /archive/api/curate/:period and
 * dispatches the request to the InvoiceArchive context.
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.createJob = async function (req, res, app, db) {

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
