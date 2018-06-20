'use strict';

/**
 * Curator API handlers
 */

const curatorContext = require('../../../curator');
const MsgTypes = require('../../../../shared/msg_types');

/**
 * Handles
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
      case MsgTypes.TENANT_DAILY:
        res.send(await curatorContext.rotateTenantsDaily(db));
        break;

      case MsgTypes.GLOBAL_DAILY:
        res.status(200).send(await curatorContext.rotateGlobalDaily());
        break;

      default:
        res.status(400).send(`Do not know what to do: ${period}`);
    }
  } catch (e) {
    res.status(500).send(e);
  }
};
