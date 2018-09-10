'use strict';

/**
 * TenantConfig API handlers
 */

const validTypes = [
    'invoice_receiving'
];

module.exports.get = async function (req, res, app, db) {
    const Sequelize = db.Sequelize;

    try {
        let type = req.params.type;
        if (!validTypes.includes(type)) {
            return sendErrorResponse(req, res, 400, 'Wrong parameters.');
        }

        let tenantConfigModel;

        /* Check if owning tenantId has valid archive configuration */
        tenantConfigModel = await db.modelManager.getModel('TenantConfig');

        let tenantConfigs = [];
        if (isAdmin(req)) {
            tenantConfigs = await tenantConfigModel.findAll();
        } else {
            let tenants = (await req.opuscapita.getUserTenants());

            tenantConfigs = await tenantConfigModel.findOne({
                where: {
                    tenantId: {
                        [Sequelize.Op.in]: tenants
                    }
                }
            });
        }

        let result = tenantConfigs.map((config) => config.tenantId);

        res.status(200).json(result);
    } catch (e) {
        switch (e.code) {
            case '':
                sendErrorResponse(req, res, 500, '');
                break;

            default:
                sendErrorResponse(req, res, 500, 'The application encountered an unexpected error.');
        }
    }
};

/**
 * TODO move to shared module
 */
function isAdmin(req) {
    return req
        .opuscapita.userData()
        .roles
        .some(r => r === 'admin');
}

/**
 * TODO move to shared module
 */
function sendErrorResponse(req, res, status = 400, msg = '') {
    return res.status(status).json({
        error: {
            message: msg
        }
    });
}
