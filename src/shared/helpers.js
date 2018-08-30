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

module.exports = {
    normalizeTenantId
};
