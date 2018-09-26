'use strict';

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

module.exports.accessIndex = async function canReadIndex(req, res, next) {

    let index = null;

    if (req.query && req.query.index) {
        index = req.query.index;
    }
    if (req.params && req.params.index) {
        index = req.params.index;
    }

    if (!index) {
        return res.status(400).json({success: false, message: 'Missing params.'});
    }

    if (!isValidIndexIdentifier(index)) {
        return res.status(404).json({success: false, message: 'Not found'});
    }

    let tenants = [];
    let tenantId = index.split('-')[1];

    if (!tenantId || !(!tenantId.startsWith('c_') || !tenantId.startsWith('s_'))) {
        return res.status(404).json({success: false, message: 'Invalid index name.'});
    }

    try {
        tenants = (await req.opuscapita.getUserTenants());
        if (!hasTenantAccess(tenantId, tenants)) {
            res.status(403).json({success: false, message: 'Access denied.'});
        }
    } catch (e) {
        res.status(400).json({
            success: false,
            message: 'Failed to fetch user tenants.'
        });
    }

    next();
};

function hasTenantAccess(tenantId, tenants = []) {
    let allowed = false;

    let hasAll = tenants.find(t => t === '*');
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

function isValidIndexIdentifier(index) {
    if (typeof index !== 'string') return false;
    if (index.indexOf('archive_invoice_tenant_yearly-') !== 0) return false;
    if (index.split('-').length !== 3) return false;

    return true;
}
