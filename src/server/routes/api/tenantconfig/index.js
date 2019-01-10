'use strict';

/**
 * TenantConfig API handlers
 */

const validTypes = [
    'invoice_receiving',
    'all'
];

/**
 * Creates a mapping from current user's tenants to customer names.
 *
 * TODO currently only supports "customers"!
 *
 * The customerIds are fetched from getUserTenants() and the company
 * names from the customer service.
 *
 * @async
 * @function get
 *
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {String} req.body.transactionId - ID of the transaction to archive
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 *
 * @returns undefined
 */
module.exports.get = async function (req, res, app, db) {

    try {
        const type = req.params.type;

        if (!validTypes.includes(type)) {
            return sendErrorResponse(req, res, 400, 'Wrong parameters.');
        }

        /** Fetch config for all user tenants */
        const tenantConfigModel = await db.modelManager.getModel('TenantConfig');
        let tenantConfigs = [];

        if (isAdmin(req)) {
            tenantConfigs = await tenantConfigModel.findAll();
        } else {
            const tenants = await req.opuscapita.getUserTenants();

            if (tenants && Array.isArray(tenants)) {
                if (tenants.some(e => e === '*')) {
                    tenantConfigs = await tenantConfigModel.findAll();
                } else {
                    let query = {
                        where: {
                            tenantId: {$in: tenants}
                        }
                    };

                    if (type !== 'all') {
                        query.where.type = type;
                    }

                    tenantConfigs = await tenantConfigModel.findAll(query);
                }
            }
        }

        const tenantIds = tenantConfigs.map((config) => config.tenantId);
        const customerIds = tenantIds
            .filter(id => id.startsWith('c_'))
            .map(id => id.replace(/^c_/, ''));

        /** Fetch customer information from customer service */
        const customers = await req.opuscapita.serviceClient.get('customer', `/api/customers/?id=${customerIds.join(',')}`);

        /** Enrich the customer information with archiving enabled with the humand readable customer name */
        const customerMapping = [];
        for (const id of customerIds) {
            const entry = customers[0].find(e => e.id === id);
            if (entry) {
                customerMapping.push({
                    id: `c_${id}`,
                    name: entry.name
                });
            }
        }

        res.status(200).json(customerMapping);
    } catch (e) {
        req.opuscapita.logger.error('TenantConfigHandler#get: Exception caught while trying to build customer list. ', e);
        sendErrorResponse(req, res, 500, 'The application encountered an unexpected error.');
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
