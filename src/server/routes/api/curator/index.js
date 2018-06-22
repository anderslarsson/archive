'use strict';

/**
 * Curator API handlers
 */

const curatorContext = require('../../../curator');
const MsgTypes = require('../../../../shared/msg_types');

/**
 * Handles requests to /archive/api/curate/:period and
 * dispatches the request to the curator context.
 *
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.curate = async function (req, res, app, db) {
  let period = req.params.period;

  try {
    switch (period) {
      case MsgTypes.CREATE_GLOBAL_DAILY:
        res.status(200).send(await curatorContext.rotateGlobalDaily());
        break;

      case MsgTypes.UPDATE_TENANT_MONTHLY:
        res.send(await curatorContext.rotateTenantsDaily(db));
        break;

      case MsgTypes.UPDATE_TENANT_YEARLY:
        res.send(await curatorContext.rotateTenantsMonthly(db));
        break;

      default:
        res.status(400).send(`Do not know what to do: ${period}`);
    }
  } catch (e) {
    req.opuscapita.logger.error('Failure in archive curator.');
    res.status(500).send(e);
  }
};
