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

        let tenantIds = tenantConfigs.map((config) => config.tenantId);

        let customerIds = tenantIds
            .filter(id => id.startsWith('c_'))
            .map(id => id.replace(/^c_/, ''));

        let customers = await req.opuscapita.serviceClient.get('customer', `/api/customers/?id=${customerIds.join(',')}`);

        let customerMapping = [];
        for (const id of customerIds) {
            const entry = customers[0].find(e => e.id === id);
            if (entry) {
                customerMapping.push({
                    id: `c_${id}`,
                    name: entry.name
                });
            } else {
                /* Customer id not found in response */
            }
        }

        res.status(200).json(customerMapping);
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

module.exports.post = async function post(req, res, app, db) {
    if (!isAdmin(req)) {
        res.status(403).json({success: false, message: 'Access denied'});
        return false;
    }

    if (!req.body || !req.body.tenantId) {
        res.status(400).json({success: false, message: 'Missing parameters.'});
        return false;
    }

    try {
        let tenantConfigModel;

        /* Check if owning tenantId has valid archive configuration */
        tenantConfigModel = await db.modelManager.getModel('TenantConfig');

        let insertResult = await tenantConfigModel.findOrCreate({
            where: {
                tenantId: req.body.tenantId
            }, defaults: {
                type: 'invoice_receiving',
                retentionPeriodHot: 30,
                retentionPeriodLongTerm: 10
            }
        });

        res.status(200).json({success: true, data: insertResult[0]});
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
