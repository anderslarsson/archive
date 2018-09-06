'use strict';

const elasticContext = require('../../../../shared/elasticsearch');

const validTypes = [
    'monthly',
    'yearly'
];

/**
 * @function listAllByType
 *
 */
module.exports.listAllByType = async function listAllByType(req, res) {
    try {
        let type = req.params.type;
        if (!validTypes.includes(type)) {
            return sendErrorResponse(req, res, 400, 'Wrong parameters.');
        }

        // Fetch tenants from session
        let tenants = (await req.opuscapita.getUserTenants());
        // .map(tenant => {
        //   return req.opuscapita.getCustomerId(tenant) || req.opuscapita.getSupplierId(tenant);
        // })
        // .filter(tenant => tenant !== null);

        // Fetch indices for all configured tenants from ES
        let fetchResults = tenants.map(async (tenantId) => {
            let indicesList = await fetchIndicesFromEs(tenantId, type);
            return {
                tenant: tenantId,
                type: type,
                indices: indicesList
            };
        });

        let tenantIndices = await Promise.all(fetchResults);
        let tenantIndicesCleaned = tenantIndices.filter((tenant) => tenant.indices.length > 0);

        res.status(200).json(tenantIndicesCleaned);
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

module.exports.listAllByTenantAndType =  async function listAllByTenantAndType(req, res) {
    let tenantId = req.params.tenantId;
    // TODO check that user is allowed to list tenant's indices

    let type = req.params.type;
    if (!validTypes.includes(type)) {
        return sendErrorResponse(400, 'Wrong parameters.');
    }

    try {
        let indicesList = await fetchIndicesFromEs(tenantId, type);
        return res.status(200).json(indicesList);
    } catch (e) {
        return sendErrorResponse(500, 'Unable to fetch indices from Elasticsearch.');
    }

};

/**
 * Open the given ES index and return the success of this operation.
 *
 * @async
 * @function openIndex
 */
module.exports.openIndex = async function openIndex(req, res) {
    let index = req.params && req.params.id;

    // TODO validate permission based on tenantId

    if (index) {
        try {
            let result = await elasticContext.openIndex(index, false);

            if (result) {
                res.status(200).json({success: true});
            } else {
                throw new Error(`Unable to open index ${index}`);
            }
        } catch (e) {
            req.opuscapita.logger.error(e);

            // Server error
            res.status(500).json({sucess: false});
        }
    }

    // Client error
    res.status(400).json({success: false});
};

async function fetchIndicesFromEs(tenantId, type = '*') {
    let indices = await elasticContext.getTenantIndices(tenantId, type);

    // Build the list of available indices
    let result = [];
    for (let index in indices) {
        result.push(index);
    }

    return result;
}

function sendErrorResponse(req, res, status = 400, msg = '') {
    return res.status(status).json({
        error: {
            message: msg
        }
    });
}


