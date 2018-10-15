'use strict';

const elasticContext = require('../../../../shared/elasticsearch');

/**
 * Get all invoice indices for the tenant given in the request params.
 *
 * @function get
 */
module.exports.get = async function get(req, res) {
    let tenantId = req.query.tenantId;
    let type = req.query.type;

    if (type !== 'invoice') {
        res.status(400).json({
            success: false,
            message: 'Not implmented'
        });
    }

    let result = await elasticContext.listIndices(tenantId, type);

    let indexNames = [];
    for (let name in result) {
        indexNames.push(name);
    }

    res.status(200).json({success: true, data: indexNames});
};

