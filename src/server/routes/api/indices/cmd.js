'use strict';

const elasticContext = require('../../../../shared/elasticsearch/elasticsearch');

/**
 * Open the given ES index and return the success of this operation.
 *
 * @async
 * @function openIndex
 */
module.exports.openIndex = async function openIndex(req, res) {
    let index = req.params && req.params.index;

    if (index) {
        try {
            let result = await elasticContext.openIndex(index, false);

            if (result) {
                res.status(200).json({success: true});
            } else {
                throw new Error(`Unable to open index ${index}`);
            }
        } catch (e) {
            const msg = `Cmd#openIndex: Failed to open elasticsearch index ${index}`;
            req.opuscapita.logger.error(msg, e);

            // Server error
            res.status(500).json({sucess: false, error: msg});
        }
    } else {
        // Client error
        res.status(400).json({success: false, error: 'Missing parameter: index'});
    }
};
