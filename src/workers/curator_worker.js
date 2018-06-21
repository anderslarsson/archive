'use strict';

/**
 * Worker module to do the actual log rotation.
 *
 * Log rotation:
 *  1. Copy BN TX log index to archive index
 *    - Runs daily
 *    - Copies entries from daily TnT to daily Archive
 *      - eg.: bn_tx_logs-2018.05.13 to archive_global_daily-2018.05.13
 *    - Kept for 60 days
 *    - @event {MsgTypes.CREATE_GLOBAL_DAILY]
 *  1.1 Delete archive_global_daily indices older than 60 days *
 *    - Runs daily
 *  2. Copy entries from daily archive index to tenant specific, monthly archive index
 *    - Runs daily/monthly
 *    - Copies all entries from the previous month/day from the daily indices  to a tenant specific monthly index
 *      - eg. all entries for tenant OC1001 from archive_global_daily-2018.05.* to archive_tenant_monthly-OC1001-2018.05
 *  3. Close all tenant indices older than 90 days
 *  4. Monthly archive index to yearly index
 *    - Runs monthly
 *    - Once a month update every tenant's yearly index with the last months archive_tenant_monthly index
 *  5. Remove all archive_tenant_monthly indices older than one year.
 *    - Runs monthly
 *
 */

const EventClient = require('@opuscapita/event-client');
const Logger      = require('ocbesbn-logger');
const MsgTypes    = require('../shared/msg_types');

const esClient = require('../server/elastic_client');

const events = new EventClient({
  // Override needed for non-containerized testing
  consulOverride: {
    host: 'localhost',
    // mqServiceName  : 'rabbitmq-amqp',
    password: 'notSecureP455w0rd',
    username: 'rabbit'
  }
});

const logger = new Logger({
  context: {
    serviceName: 'archive'
  }
});

// Subscribe to archive.curator.wait topic
events.subscribe('archive.curator.wait', waitDispatcher);

/**
 * @function handleCreateGlobalDaily
 *
 * Handler for msg.type = "daily"
 *
 * Triggers the reindexing from eg.: bn_tx_logs-2018.05.* to archive_global_daily-2018.05.*
 *
 */
async function handleCreateGlobalDaily() {
  let result;
  let returnValue = false;

  try {
    result = await esClient.reindexGlobalDaily();

    if (result) {
      if (result.failures && result.failures >= 1) {
        returnValue = false;
        logger.error('Failed to create archive_global_daily index. Response contained failures.');
      } else {
        returnValue = true;
        logger.log('Successfully created archive_global_daily');
      }
    }
  } catch (e) {
    // Dismiss event incase the source index does not exist.
    returnValue = (e.code = 'ERR_SOURCE_INDEX_DOES_NOT_EXIST') ? null : false;

    logger.error('Failed to create archive_global_daily index.');
    logger.error(e);
  }

  return returnValue;
}

/**
 * @function handleUpdateTenantYearly
 *
 * Handler for msg.type = "daily"
 *
 * Triggers the reindexing from eg.: bn_tx_logs-2018.05.*
 * to archive_global_daily-2018.05.*
 *
 * @params {Object} tenantConfig - JSON representation of TenantConfig Sequelize model
 * @returns {Promise}
 *
 */
async function handleUpdateTenantYearly(tenantConfig) {
  let returnValue = false;

  let tenantId = tenantConfig.customerId || tenantConfig.supplierId;

  try {
    let result = await esClient.reindexTenantMonthlyToYearly(tenantId);

    if (result) {
      if (result.failures && result.failures >= 1) {
        returnValue = false;
        logger.error('Could not update archive_tenant_yearly : ' + result.failures);
      } else {
        returnValue = true;
        logger.error('Successfully created archive_global_daily');
      }
    }
  } catch (e) {
    // Dismiss event incase the source index does not exist.
    returnValue = (e.code = 'ERR_SOURCE_INDEX_DOES_NOT_EXIST') ? null : false;

    logger.error('Failed to create archive_global_daily index.');
    logger.error(e);
  }

  // TODO create/update tenant record in RDB pointing to the ES index

  return returnValue;
}
/**
 * @function handleUpdateTenantMonthly
 *
 * Handler for msg.type = "daily"
 *
 * Triggers the reindexing from eg.: bn_tx_logs-2018.05.*
 * to archive_global_daily-2018.05.*
 *
 * @params {Object} tenantConfig - JSON representation of TenantConfig Sequelize model
 * @returns {Promise}
 *
 */
async function handleUpdateTenantMonthly(tenantConfig) {
  let returnValue = false;

  let tenantId = tenantConfig.customerId || tenantConfig.supplierId;

  try {
    let query = await buildTenantQueryParam(tenantConfig);
    let result = await esClient.reindexGlobalDailyToTenantMonthly(tenantId, query);

    if (result) {
      if (result.failures && result.failures >= 1) {
        returnValue = false;
        logger.error('Could not create archive_tenant_monthly WITH errors: ' + result.failures);
      } else {
        returnValue = true;
        logger.error('Successfully created archive_global_daily');
      }
    }
  } catch (e) {
    // TODO handle "Index not found" Exception - happens when we
    // try to run this, before the archive_global_daily is available.
    returnValue = false;
    logger.error('Failed to create archive_global_daily index.');
    logger.error(e);
  }

  // TODO create/update tenant record in RDB pointing to the ES index

  return returnValue;
}

/**
 * Callback method for @see EventClient.subscribe method.
 *
 * @param {Object} msg - Message received from MQ
 * @returns {Boolean} - Indicates the success of the job processing
 *
 */
function waitDispatcher(msg) {
  let result = false;

  switch (msg.type) {
    case MsgTypes.CREATE_GLOBAL_DAILY:
      result = handleCreateGlobalDaily();
      break;
    case MsgTypes.UPDATE_TENANT_MONTHLY:
      result = handleUpdateTenantMonthly(msg.tenantConfig);
      break;
    case MsgTypes.UPDATE_TENANT_YEARLY:
      result = handleUpdateTenantYearly(msg.tenantConfig);
      break;
    default:
      logger.error('CuratorWorker: No handle for msg.type ' + msg.type);
      result = null; // Dismiss message from the MQ as the given type is not implemented.
  }

  return result;
}

/**
 * @function buildTenantQueryParam
 *
 * Takes a tenantConfig Object and creates an ES query out of it.
 *
 * @params {Object} tenantConfig - JSON representation of TenantConfig Sequelize model
 * @returns {Promise}
 *
 */
async function buildTenantQueryParam({customerId, supplierId}) {
  if (customerId === null && supplierId === null) {
    throw new Error('TenantConfig does not contain a supplier or customer ID.');
  }

  let queryParam = {
    match: {}
  };

  if (customerId) {
    queryParam.match['event.customerId'] = {
      query: customerId,
      type: 'phrase'
    };
  }

  if (supplierId) {
    queryParam.match['event.supplierId'] = {
      query: supplierId,
      type: 'phrase'
    };
  }

  return queryParam;
}
