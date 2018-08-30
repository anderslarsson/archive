'use strict';

const elasticContext = require('../../../../shared/elasticsearch');

/**
 * @function get
 *
 * Get all invoice indices for the tenant given in the request params.
 *
 */
module.exports.get = async function get(req, res) {
    let tenantId = req.params.tenantId;

    let result = await elasticContext.listIndices(tenantId, 'invoice');

    let indexNames = [];
    for (let name in result) {
        indexNames.push(name);
    }

    res.status(200).json({success: true, data: indexNames});
};

