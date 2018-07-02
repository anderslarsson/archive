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

const MsgTypes       = require('../shared/msg_types');
const ErrCodes       = require('../shared/error_codes');

const elasticContext = require('../server/elasticsearch');

const events = new EventClient({
  exchangeName: 'archive',
  messageLimit: 1,

  // Override needed for non-containerized testing
  consulOverride: {
    host: 'localhost',
    port: '5672',
    password: 'notSecureP455w0rd',
    username: 'rabbit'
  }
});

const logger = new Logger({
  context: {
    serviceName: 'archive'
  }
});

// Subscribe to archive.curator.logrotation.job.created topic
events.subscribe('archive.curator.logrotation.job.created');
waitDispatcher();

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
    result = await elasticContext.reindexGlobalDaily();

    if (result) {
      if (result.failures && result.failures >= 1) {
        returnValue = false;
        logger.error('Failed to create archive_global_daily index. Response contained failures.');
      } else {
        returnValue = true;
        logger.log('Successfully created archive_global_daily');

        events.emit('archive.curator.logrotation.job.finished', {
          type: MsgTypes.CREATE_GLOBAL_DAILY
        }).catch((e) => logger.error(e));
      }
    }
  } catch (e) {
    // Dismiss event incase the source index does not exist.
    if (e && e.code && ErrCodes.hasOwnProperty(e.code)) {
      returnValue = null;
    }

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
    let result = await elasticContext.reindexTenantMonthlyToYearly(tenantId);

    if (result) {
      if (result.failures && result.failures >= 1) {
        returnValue = false;
        logger.error('Could not update archive_tenant_yearly : ' + result.failures);
      } else {
        returnValue = true;
        logger.log(`Successfully created archive_tenant_yearly for tenantId ${tenantId}`);

        events.emit('archive.curator.logrotation.job.finished', {
          type: MsgTypes.UPDATE_TENANT_YEARLY,
          tenantConfig: tenantConfig
        }).catch((e) => logger.error(e));
      }
    }
  } catch (e) {
    // Dismiss event incase the source index does not exist.
    if (e && e.code && ErrCodes.hasOwnProperty(e.code)) {
      returnValue = null;
    }

    logger.error('Failed to update archive_tenant_yearly index for tenant ' + tenantId);
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
    let result = await elasticContext.reindexGlobalDailyToTenantMonthly(tenantId, query);

    if (result) {
      if (result.failures && result.failures >= 1) {
        returnValue = false;
        logger.error('Failed to create archive_tenant_monthly, errors: ' + result.failures);
      } else {
        returnValue = true;
        logger.log('Successfully created archive_global_daily');

        events.emit('archive.curator.logrotation.job.finished', {
          type: MsgTypes.UPDATE_TENANT_MONTHLY,
          tenantConfig: tenantConfig
        }).catch((e) => logger.error(e));
      }
    }
  } catch (e) {
    if (e && e.code && ErrCodes.hasOwnProperty(e.code)) {
      // Dismiss event incase the source index does not exist.
      returnValue = null;
    }

    logger.error('Failed to update archive_tenant_monthly index for tenant ' + tenantId);
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
async function waitDispatcher() {
  let msg, result;

  try {
    result = false;

    msg = await events.getMessage('archive.curator.logrotation.job.created', false); // Get single message, no auto ack

    if (msg && msg.payload && msg.payload.type) {
      let payload = msg.payload;

      switch (payload.type) {
        case MsgTypes.CREATE_GLOBAL_DAILY:
          result = await handleCreateGlobalDaily();
          break;
        case MsgTypes.UPDATE_TENANT_MONTHLY:
          result = await handleUpdateTenantMonthly(payload.tenantConfig);
          break;
        case MsgTypes.UPDATE_TENANT_YEARLY:
          result = await handleUpdateTenantYearly(payload.tenantConfig);
          break;
        default:
          logger.error('CuratorWorker: No handle for msg.type ' + payload.type);
          result = null; // Dismiss message from the MQ as the given type is not implemented.
      }

      if (result === null) {
        // FIXME 
        // Broken because default for nackMessage is requeue = true, meaning that
        // the message will be put back into the queue instead of being thrown away.
        // See @opuscapita/event-client #3
        logger.error(`Nacking message with deliveryTag ${msg.tag}`);
        await events.nackMessage(msg);
      }

      if (result) {
        logger.log(`Acking message with deliveryTag ${msg.tag}`);
        await events.ackMessage(msg);
        logger.log('Finished curator job with result: \n' + result);
      }
    }
  } catch (handleMessageError) {

    logger.error(handleMessageError);

    if (msg) {
      try {
        // Requeu message
        await events.nackMessage(msg);
      } catch (nackErr) {
        logger.error(nackErr);
      }
    }
  } finally {
    // restart the timer
    setTimeout(waitDispatcher, 1000);
  }
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
    term: {}
  };

  if (customerId) {
    queryParam.term['event.customerId.keyword'] = customerId;
  }

  if (supplierId) {
    queryParam.term['event.supplierId.keyword'] = supplierId;
  }

  return queryParam;
}
