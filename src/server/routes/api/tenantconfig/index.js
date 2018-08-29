'use strict';

const Sequelize = require('sequelize');

/**
 * TenantConfig API handlers
 */

const validTypes = [
    'invoice_receiving'
];

// module.exports.post = async function(req, res, app, db) {
//     let body = req.body;

//     return res;
// };

module.exports.get = async function (req, res, app, db) {
    try {
        let type = req.params.type;
        if (!validTypes.includes(type)) {
            return sendErrorResponse(req, res, 400, 'Wrong parameters.');
        }

        let tenantConfigModel;

        /* Check if owning tenantId has valid archive configuration */
        tenantConfigModel = await db.modelManager.getModel('TenantConfig');
        // Fetch tenants from session
        let tenantConfigs = [];
        if (isAdmin(req)) {
            tenantConfigs = await tenantConfigModel.findAll();
        } else {
            let tenants = (await req.opuscapita.getUserTenants());
            // .map(tenant => {
            //     return req.opuscapita.getCustomerId(tenant) || req.opuscapita.getSupplierId(tenant);
            // })
            // .filter(tenant => tenant !== null);

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
        /* handle error */
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
