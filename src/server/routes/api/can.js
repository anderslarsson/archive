'use strict';

/**
 * Express middleware to check if the the given tenant is in the current user's tenant list.
 *
 * @param {string} res.query.tenantId
 */
module.exports.listInvoiceIndicesByTenantId = async function listInvoiceIndicesByTenantId(req, res, next) {
    if (!req.query.tenantId) {
        res.status(400).json({
            success: false,
            message: 'No tenantId found in query.'
        });
    }

    let tenantId = req.query.tenantId;

    let allowed = false;
    let tenants = [];

    try {
        tenants = (await req.opuscapita.getUserTenants());
        allowed = hasTenantAccess(tenantId, tenants);
    } catch (e) {
        res.status(400).json({
            success: false,
            message: 'Failed to fetch user tenants.'
        });
    }

    if (allowed) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: ` Access denied for tenantId ${tenantId}`
        });
    }
};

/**
 * Express middleware to check if the current user is allowed to read
 * from the given Elasticsearch index.
 *
 * @param {string} [res.query.index] - Elasticsearch index name
 * @param {string} [res.params.index] - Elasticsearch index name
 */
module.exports.accessIndex = async function canReadIndex(req, res, next) {
    let index = null;

    if (req.query && req.query.index) {
        index = req.query.index;
    }
    if (req.params && req.params.index) {
        index = req.params.index;
    }

    if (!index) {
        return res.status(400).json({success: false, message: 'Missing parameter :index.'});
    }

    if (!isValidIndexIdentifier(index)) {
        return res.status(404).json({success: false, message: 'Invalid index name.'});
    }

     const tenantId = /^(?:archive_tenant_yearly-|archive_invoice_tenant_yearly-)((?:c_|s_)[\w-]*)(?:-\d{4})/gm.exec(index)[1];

    if (!tenantId || !(!tenantId.startsWith('c_') || !tenantId.startsWith('s_'))) {
        return res.status(404).json({success: false, message: 'Invalid index name.'});
    }

    let tenants = [];
    try {
        tenants = (await req.opuscapita.getUserTenants());
        if (!hasTenantAccess(tenantId, tenants)) {
            res.status(403).json({success: false, message: 'You are not allowed to access this index.'});
        }
    } catch (e) {
        res.status(400).json({ success: false, message: 'Failed to fetch user tenants.' });
    }

    next();
};

function hasTenantAccess(tenantId, tenants = []) {
    let allowed = false;

    const hasAll = tenants.find(t => t === '*');
    if (hasAll) {
        allowed = true;
    }

    let hasTenant = tenants.find(t => {
        return t.toLowerCase() === tenantId.toLowerCase();
    });
    if (hasTenant) {
        allowed = true;
    }

    return allowed;
}

/**
 * Check if a given string is valid archive
 * index indentifier.
 *
 * @function isValidIndexIdentifier
 * @param {string} index - Identifier to check
 * @returns {boolean} Validity
 */
function isValidIndexIdentifier(index) {
    if (typeof index !== 'string')
        return false;

    const validPrefix = ['archive_invoice_tenant_yearly-', 'archive_tenant_yearly-']
        .some((p) => index.indexOf(p) === 0);

    if (!validPrefix)
        return false;

    if (index.split('-').length < 3)
        return false;

    return true;
}
