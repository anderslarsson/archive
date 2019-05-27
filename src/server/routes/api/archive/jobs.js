'use strict';

const {isValid, format, startOfDay, subDays} = require('date-fns');

const Logger         = require('ocbesbn-logger'); // Logger
const configClient   = require('@opuscapita/config');
const ArchiveConfig  = require('../../../../shared/ArchiveConfig');

const logger = new Logger();

/**
 * Job creation endpoint.
 *
 * @async
 * @function create
 * @param {object] req - Express request object
 * @param {string} req.params.type - Type of the job that should be created
 * @param {string} [req.body.date] - Date used as starting point for the archiving process, custom lookback will be substracted from this.
 */
module.exports.create = async function create(req, res, app, db) {
    let success     = false;
    let triggerDate = null;

    const {date, tenantId} = req.body;

    if (date) {
        triggerDate = new Date(date);

        if (!isValid(triggerDate))
            throw new Error('Param date not valid.');
    }

    try {
        const result = await triggerDailyRotation(db, req.opuscapita.eventClient, {triggerDate, tenantId});

        if (result && result.fail && result.fail.length === 0) {
            success = true;
        } else {
            logger.error('Failed to trigger daily rotation for tenants: ', result.fail);
            success = false;
        }
    } catch (e) {
        logger.error(`${__filename}#create: Failed to call triggerDailyRotation with exception.`, e);
        throw e;
    }

    res.status(200).json({success});
};

/**
 * Trigger the daily rotation of log files from TnT logs to
 * tenant specific archive indices.
 *
 * @function triggerDailyRotation
 * @param {object} db - Sequelize instance
 * @param {object} eventClient - EventClient instance
 * @param {Object} opts
 * @param {date} opts.string
 * @param {string} opts.tenantId
 * @return {Promise}
 * @fulfil {object} Two element object with done and failed configs.
 * @reject {Error}
 */
async function triggerDailyRotation(db, eventClient, {triggerDate, tenantId}) {
    let done = [];
    let fail = [];

    await configClient.init();

    const lookback = await configClient.getProperty('config/archiver/generic/lookback');
    if (!lookback) {
        const message = 'Failed to fetch lookback value from consul.';
        const e = new Error(message); e.httpCode = 500;

        this.logger.error(message);
        throw e;
    }

    const dayToArchive = format(subDays(triggerDate || Date.now(), lookback), 'YYYY-MM-DD');

    try {
        // Fetch all configured tenants
        const minGoLiveDay = subDays(startOfDay(Date.now()), lookback);

        const where = {
            where: {
                type: 'generic',
                goLive: {
                    $lte: minGoLiveDay
                }
            }
        };

        if (tenantId)
            where.where.tenantId = tenantId;

        const tenantConfigModel = await db.modelManager.getModel('TenantConfig');
        const configs = await tenantConfigModel.findAll(where);

        if (!Array.isArray(configs)) {
            logger.error(`No tenant configuration found.`);
        }

        // Enqueue a job for every tenant who has archive activated
        for (let config of configs) {
            try {
                logger.info(`Queuing daily archive rotation for ${config.tenantId} tenants on day ${dayToArchive}.`);

                let result = await eventClient.emit(ArchiveConfig.dailyArchiveJobPendingTopic, {
                    type: 'daily',
                    date: dayToArchive,
                    tenantConfig: config
                });

                if (result) {
                    done.push(config);
                } else {
                    fail.push(config);
                }
            } catch (e) {
                logger.error('Could not emit archive event UPDATE_TENANT_YEARLY for tenant ID' + (config.supplierId || config.customerId));
                fail.push(config)
            }
        }

    } catch (e) {
        logger.error('Jobs#triggerDailyRotation: Failed to queue jobs with exception.' , e);
    }

    return { done, fail };
}
