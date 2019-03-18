'use strict';

const {format, startOfDay, subDays} = require('date-fns');

const Logger         = require('ocbesbn-logger'); // Logger
const ArchiveConfig  = require('../../../../shared/ArchiveConfig');
const logger         = new Logger();
const configClient   = require('@opuscapita/config');

/**
 * Job creation endpoint.
 *
 * @async
 * @function create
 * @param {object] req - Express request object
 * @param {string} req.params.type - Type of the job that should be created
 */
module.exports.create = async function create(req, res, app, db) {
    let success = false;

    try {
        const result = await triggerDailyRotation(db, req.opuscapita.eventClient);

        if (result && result.fail && result.fail.length === 0) {
            success = true;
        } else {
            logger.error('Failed to trigger daily rotation for tenants: ', result.fail);
            success = false;
        }
    } catch (e) {
        logger.error(`${__filename}#create: Failed to call triggerDailyRotation with exception.`, e);
        success = false;
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
 * @return {Promise}
 * @fulfil {object} Two element object with done and failed configs.
 * @reject {Error}
 */
async function triggerDailyRotation(db, eventClient) {
    let done = [];
    let fail = [];

    await configClient.init();
    const lookback = await configClient.getProperty('config/archiver/generic/lookback');

    try {
        // Fetch all configured tenants
        const minGoLiveDay = subDays(startOfDay(Date.now()), lookback);

        const tenantConfigModel = await db.modelManager.getModel('TenantConfig');
        const configs           = await tenantConfigModel.findAll({
            where: {
                type: 'generic',
                goLive: {
                    $gte: minGoLiveDay
                }
            }});

        if (Array.isArray(configs)) {
            logger.info(`Queuing daily archive rotation for ${configs.length} tenants.`);
        } else {
            logger.error(`No tenant configuration found.`);
        }

        // Enqueue a job for every tenant who has archive activated
        for (let config of configs) {
            try {
                let result = await eventClient.emit(ArchiveConfig.dailyArchiveJobPendingTopic, {
                    type: 'daily',
                    date: Date.now(),
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
