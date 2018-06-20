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
const Logger = require('ocbesbn-logger');

const moment = require('moment');
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
events.subscribe('archive.wait', waitDispatcher);

/**
 * Handler for msg.type = "daily"
 *
 * Triggers the reindexing from eg.: bn_tx_logs-2018.05.* to archive_global_daily-2018.05.*
 *
 */
function handleGlobalDaily() {
  let yesterday = moment().subtract(1, 'days').format('YYYY.MM.DD');
  let result = esClient.reindexGlobalDaily();

  wait(5000);

  return true;
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
    case 'global_daily':
      result = handleGlobalDaily();
      break;
    default:
      logger.error('CuratorWorker: No handle for msg.type ' + msg.type);
      result = null;
  }

  console.log('Event result: ' + result);

  return result;
}

function wait(ms) {
  let start = Date.now();
  let now = start;

  while (now - start < ms) {
    now = Date.now();
  }
}
