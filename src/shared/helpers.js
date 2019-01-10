'use strict';

/**
 * Normalize a tenantId (to lower case) so we can use
 * it as part of the ES index name.
 *
 * ES only allows lower case index names and tenantId
 * are persisted in a case-insensitive manner -> convert to lower.
 *
 *
 */
function normalizeTenantId(tenantId) {
    let normalizedTenantId = tenantId;

    if (tenantId && tenantId.toLowerCase) {
        normalizedTenantId = tenantId.toLowerCase();
    }

    return normalizedTenantId;
}

/**
 * Check if a tenant is customer.
 *
 * @function isCustomer
 * @param {string} tenantId
 * @return {boolean}
 */
function isCustomer(tenantId) {
    return tenantId.startsWith('c_') ? true : false;
}

/**
 * Check if a tenant is supplier.
 *
 * @function isSupplier
 * @param {string} tenantId
 * @return {boolean}
 */
function isSupplier(tenantId) {
    return tenantId.startsWith('s_') ? true : false;
}

/**
 * Remove the customer/supplier prefix from tenantId.
 *
 * @function removePrefixFromTenantId
 * @param {string} tenantId
 * @return {string}
 */
function removePrefixFromTenantId(tenantId) {
    if (isCustomer(tenantId)) {
        return tenantId.replace(/^c_/, '');
    } else if (isCustomer(tenantId)) {
        return tenantId.replace(/^s_/, '');
    }

    return tenantId;
}

module.exports = {
    isCustomer,
    isSupplier,
    normalizeTenantId,
    removePrefixFromTenantId
};
