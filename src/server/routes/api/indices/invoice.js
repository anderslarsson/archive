'use strict';

const elasticContext = require('../../../../shared/elasticsearch/elasticsearch');

/**
 * Get all invoice indices for the tenant given in the request params.
 *
 * @function get
 */
module.exports.get = async function get(req, res) {
    const tenantId = req.query.tenantId;
    const type = req.query.type;

    if (type !== 'invoice' && type !== 'all') {
        res.status(400).json({
            success: false,
            message: `Archive type ${type} not implmented`
        });
    }

    const result = await elasticContext.listIndices(tenantId, type);

    const indexNames = [];
    for (let name in result) {
        indexNames.push(name);
    }

    res.status(200).json({success: true, data: indexNames});
};

