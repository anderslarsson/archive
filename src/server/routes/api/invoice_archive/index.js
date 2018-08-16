'use strict';

/**
 * InvoiceArchive API handlers
 */

const invoiceArchiveContext = require('../../../invoice_archive');
const MsgTypes = require('../../../../shared/msg_types');

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
module.exports.createArchiverJob = async function (req, res, app, db) {
  let transactionId = req && req.body && req.body.transactionId;

  let result = null;

  try {
    result = await invoiceArchiveContext.archiveTransaction(transactionId);

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
