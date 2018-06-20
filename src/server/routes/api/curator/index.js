'use strict';

/**
 * Curator API handlers
 */

const curatorContext = require('../../../curator');

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
      case 'global_daily':
        res.status(200).send(await curatorContext.rotateGlobalDaily());
        break;
      case 'daily':
        res.send(await curatorContext.rotateDaily(db));
        break;

      case 'yearly':
        res.send(await curatorContext.rotateYearly(db));
        break;

      default:
        res.send(`Handler working: ${period}`);
    }
  } catch (e) {
    res.status(500).send(e);
  }
};
