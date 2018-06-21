'use strict';

/**
 * Curator context module
 *
 * This module is responsible for creating archiving jobs on the event bus. This
 * events will be consumed by the worker pool.
 */

const Logger      = require('ocbesbn-logger');
const EventClient = require('@opuscapita/event-client');
const MsgTypes    = require('../shared/msg_types');

const events = new EventClient({
  exchangeName: 'archive',
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
 * @function rotateTenantsDaily
 *
 * Trigger the daily rotation of tenant transaction logs from
 * TX logs to archive.
 *
 * @param {Sequelize} db - Sequelize db object
 */
module.exports.rotateTenantsDaily = async function (db) {
  let results = [];

  try {

    // Fetch all configured tenant configurations
    let tenantConfigModel = await db.modelManager.getModel('TenantConfig');
    let configs           = await tenantConfigModel.findAll();

    // Enqueue a job for every tenant who has archive activated
    for (let config of configs) {
      try {
        let result = await events.emit('archive.curator.logrotation.job.created', {
          type: MsgTypes.UPDATE_TENANT_MONTHLY,
          tenantConfig: config
        });

        results.push(result);
      } catch (e) {
        logger.error('Could to emit archive event tenants_daily for tenant.' + (config.supplierId || config.customerId));
        results.push(Promise.resolve(false));
      }
    }

  } catch (e) {
    let msg = 'Exception caught in' + __filename;

    results = [];
    logger.error(msg);
    logger.error(e);
  }

  let emittedEvents = await Promise.all(results);

  return emittedEvents.length;
};

/**
 * @function rotateTenantsMonthly
 *
 * Trigger the daily rotation of tenant specific archive index
 * to the yearly archive index.
 *
 * @param {Sequelize} db - Sequelize db object
 * @returns {Integer} number of events created, should match the number of tenants with archive
 */
module.exports.rotateTenantsMonthly = async function (db) {
  let results = [];

  try {

    // Fetch all configured tenant configurations
    let tenantConfigModel = await db.modelManager.getModel('TenantConfig');
    let configs           = await tenantConfigModel.findAll();

    // Enqueue a job for every tenant who has archive activated
    for (let config of configs) {
      try {
        let result = await events.emit('archive.curator.logrotation.job.created', {
          type: MsgTypes.UPDATE_TENANT_YEARLY,
          tenantConfig: config
        });

        results.push(result);
      } catch (e) {
        logger.error('Could not emit archive event UPDATE_TENANT_YEARLY for tenant ID' + (config.supplierId || config.customerId));
        results.push(Promise.resolve(false));
      }
    }

  } catch (e) {
    let msg = 'Exception caught in' + __filename;

    results = [];
    logger.error(msg);
    logger.error(e);
  }

  let emittedEvents = await Promise.all(results);

  return emittedEvents.length;
};

/**
 * Trigger copy job from daily bn_tx_logs-YYYY.MM.DD to archive_global_daily-YYYY.MM.DD
 *
 */
module.exports.rotateGlobalDaily = async function () {
  await events.emit('archive.curator.logrotation.job.created', {
    type: MsgTypes.CREATE_GLOBAL_DAILY
  });

  return 'Job created successfully.';
};
