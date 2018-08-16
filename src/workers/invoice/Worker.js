/**
 * Worker module to do the actual log rotation for archive type invoice.
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

'use strict';

const EventClient = require('@opuscapita/event-client');
const Logger      = require('ocbesbn-logger');

const {
  MsgTypes,
  InvoiceArchiveConfig
} = require('../../shared/invoice_archive_config');
const Archiver = require('./Archiver');

class Worker {

  /**
   * @constructor
   */
  constructor() {

    this.logWaitDispatcherTimeout = null;
    this.archiveWaitDispatcherTimeout = null;

    this.logger = new Logger({
      context: {
        serviceName: 'archive'
      }
    });

    this.eventClient = new EventClient({
      exchangeName: 'archive',
      messageLimit: 1,
      consul: {
        host: 'consul'
      }
    });

    this.archiver = new Archiver(this.eventClient, this.logger);

    this.initEventSubscriptions();
  }

  async initEventSubscriptions() {

    if (process.env.NODE_ENV !== 'testing') {
      try {
        // Subscribe to archive.invoice.logrotation.job.created topic
        await this.eventClient.subscribe(InvoiceArchiveConfig.newLogrotationJobQueueName);
        await this.eventClient.subscribe(InvoiceArchiveConfig.newArchiveTransactionJobQueueName);
      } catch (e) {
        this.logger.error('InvoiceArchiveWorker#init: faild to initially subscribe to the ');
        throw e;
      }

      // Enter main loop
      this.logWaitDispatcher();
      this.archiveWaitDispatcher();
    }

    return true;
  }

  async archiveWaitDispatcher() {
    let msg;

    try {
      let success = false;

      msg = await this.eventClient.getMessage(InvoiceArchiveConfig.newArchiveTransactionJobQueueName, false); // Get single message, no auto ack

      if (msg && msg.payload && msg.payload.type && msg.payload.type === MsgTypes.ARCHIVE_TRANSACTION) {
        let payload = msg.payload;


        if (payload.transactionId) {
          // TODO do the magic
          success = true;
        } else {
          success = false;
          this.logger.error('Archive - Worker#archiveWaitDispatcher: No transactionId found in event payload.');
        }

        // Failure (false -> ES result contained failures)
        // Failure (null -> catch was invoked in handler function)
        if (success === false || success === null) {
          //
          // FIXME
          //
          // Broken because event-client default for nackMessage is requeue = true, meaning that
          // the message will be put back into the queue instead of being thrown away.
          // See @opuscapita/event-client #3
          this.logger.error(`Nacking message with deliveryTag ${msg.tag}`);

          await this.eventClient.nackMessage(msg);
        }

        // Success
        if (success) {
          this.logger.log(`Acking message with deliveryTag ${msg.tag}`);
          await this.eventClient.ackMessage(msg);
          this.logger.log('Finished job with result: \n' + success);
        }
      }
    } catch (handleMessageError) {

      this.logger.error(handleMessageError);

      if (msg) {
        try {
          // Requeu message
          await this.eventClient.nackMessage(msg);
        } catch (nackErr) {
          this.logger.error(nackErr);
        }
      }
    } finally {
      // Restart the timer
      this.archiveWaitDispatcherTimeout = setTimeout(this.archiveWaitDispatcher.bind(this), 1000);
    }
  }

  /**
   * Callback method for @see EventClient.subscribe method.
   *
   * @param {Object} msg - Message received from MQ
   * @returns {Boolean} - Indicates the success of the job processing
   *
   */
  async logWaitDispatcher() {
    let msg;

    try {
      let success = false;

      msg = await this.eventClient.getMessage(InvoiceArchiveConfig.newLogrotationJobQueueName, false); // Get single message, no auto ack

      if (msg && msg.payload && msg.payload.type) {
        let payload = msg.payload;

        switch (payload.type) {
          case MsgTypes.CREATE_GLOBAL_DAILY:
            success = await this.archiver.handleCreateGlobalDaily();
            break;
          case MsgTypes.UPDATE_TENANT_MONTHLY:
            success = await this.archiver.handleUpdateTenantMonthly(payload.tenantConfig);
            break;
          case MsgTypes.UPDATE_TENANT_YEARLY:
            success = await this.archiver.handleUpdateTenantYearly(payload.tenantConfig);
            break;
          default:
            this.logger.error('InvoiceArchiveWorker: No handle for msg.type ' + payload.type);
            success = null; // Dismiss message from the MQ as the given type is not implemented.
        }

        // Failure (false -> ES result contained failures)
        // Failure (null -> catch was invoked in handler function)
        if (success === false || success === null) {
          //
          // FIXME
          //
          // Broken because event-client default for nackMessage is requeue = true, meaning that
          // the message will be put back into the queue instead of being thrown away.
          // See @opuscapita/event-client #3
          this.logger.error(`Nacking message with deliveryTag ${msg.tag}`);

          await this.eventClient.nackMessage(msg);
        }

        // Success
        if (success) {
          this.logger.log(`Acking message with deliveryTag ${msg.tag}`);
          await this.eventClient.ackMessage(msg);
          this.logger.log('Finished job with result: \n' + success);
        }
      }
    } catch (handleMessageError) {

      this.logger.error(handleMessageError);

      if (msg) {
        try {
          // Requeu message
          await this.eventClient.nackMessage(msg);
        } catch (nackErr) {
          this.logger.error(nackErr);
        }
      }
    } finally {
      // Restart the timer
      this.logWaitDispatcherTimeout = setTimeout(this.logWaitDispatcher.bind(this), 1000);
    }
  }

}

module.exports = Worker;
