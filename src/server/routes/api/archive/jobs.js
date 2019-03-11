'use strict';

const Logger         = require('ocbesbn-logger'); // Logger
const ArchiveConfig  = require('../../../../shared/ArchiveConfig');
const logger         = new Logger();

/**
 * Job creation endpoint.
 *
 * @async
 * @function create
 * @param {object] req - Express request object
 * @param {string} req.params.type - Type of the job that should be created
 */
module.exports.create = async function create(req, res, app, db) {
    let result;

    try {
        result = await triggerDailyRotation(db, req.opuscapita.eventClient);
    } catch (e) {
        logger.error(__filename, '#create: Failed to call triggerDailyRotation with exception.', e);
        result = false;
    }

    res.status(200).json({success: result});
};

/**
 * Trigger the daily rotation of log files from TnT logs to
 * tenant specific archive indices.
 *
 * @function triggerDailyRotation
 * @param {object} db - Sequelize instance
 * @param {object} eventClient - EventClient instance
 * @return {Promise}
 * @fulfil {boolean} true
 * @reject {Error}
 */
async function triggerDailyRotation(db, eventClient) {
    let results = [];

    try {
        // Fetch all configured tenants
        const tenantConfigModel = await db.modelManager.getModel('TenantConfig');
        const configs           = await tenantConfigModel.findAll({where: {type: 'generic'}});

        // Enqueue a job for every tenant who has archive activated
        for (let config of configs) {
            try {
                let result = await eventClient.emit(ArchiveConfig.dailyArchiveJobPendingTopic, {
                    type: 'daily',
                    date: Date.now(),
                    tenantConfig: config
                });

                results.push(result);
            } catch (e) {
                logger.error('Could not emit archive event UPDATE_TENANT_YEARLY for tenant ID' + (config.supplierId || config.customerId));
                results.push(false);
            }
        }

    } catch (e) {
        logger.error('Jobs#triggerDailyRotation: Failed to queue jobs with exception.' , e);
        results = [];
    }

    return true;
}
