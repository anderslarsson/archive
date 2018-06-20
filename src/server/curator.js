'use strict';

/**
 * Curator context module
 *
 * This module is responsible for creating archiving jobs on the event bus. This
 * events will be consumed by the worker pool.
 */

const Logger = require('ocbesbn-logger'); // Logger
const EventClient = require('@opuscapita/event-client');

const events = new EventClient({
  consul: {
    host: 'consul'
  }
});

const logger = new Logger({
  context: {
    serviceName: 'archive'
  }
});

/**
 * Trigger the daily rotation of tenant transaction logs from TX logs to archive.
 *
 * @param {Sequelize} db - Sequelize db object
 */
module.exports.rotateDaily = async function (db) {
  logger.info('Starting curator jobs: daily');

  let result = 'all done';

  try {

    let tenantConfigModel = await db.modelManager.getModel('TenantConfig');
    let configs           = await tenantConfigModel.findAll();

    result = configs.map(async (config) => {
      try {
        let bla = await events.emit('archive.wait', {
          type: 'daily',
          tenantConfig: config
        });

        return bla;
      } catch (e) {
        logger.error('Unable to emit archive event.');
        return Promise.resolve(false);
      }
    });

  } catch (e) {
    let msg = 'Exception caught in' + __filename;

    result = Promise.resolve(msg);

    logger.error(msg);
    logger.error(e);
  }

  let emittedEvents = await Promise.all(result);

  return emittedEvents.length;
};

/**
 * Trigger copy job from daily bn_tx_logs-YYYY.MM.DD to archive_global_daily-YYYY.MM.DD
 *
 */
module.exports.rotateGlobalDaily = async function () {
  await events.emit('archive.wait', {
    type: 'global_daily'
  });

  return 'Job created successfully.';
};
