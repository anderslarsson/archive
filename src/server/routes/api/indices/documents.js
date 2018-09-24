'use strict';

const elasticContext = require('../../../../shared/elasticsearch');

/**
 * @async
 * @function get
 *
 * Get a single document from the given index by its
 * transaction ID.
 *
 * @param {express.Request} req
 * @param {object} req.params - POST data
 * @param {String} req.params.indexId - Identifier of the ES
 * @param {String} req.params.id - ID of the transaction
 * @param {express.Response} res
 *
 */
module.exports.get = async function get(req, res) {
    const logger = req.opuscapita.logger;

    if (!req.params.index || !req.params.id) {
        res.status(400).json({success: false, message: 'Missing params.'});
    }

    // TODO check if user is allowed to view index

    let index = req.params.index;
    let id = req.params.id;

    try {
        await elasticContext.openIndex(index, false);
    } catch (e) {
        logger.error('Documents#get: Index failure.', e);
        res.status(500).json({success: false, message: 'Index failure.'});
    }

    try {
        const es = elasticContext.client;

        let result = await es.get({
            index,
            type: elasticContext.defaultDocType,
            id
        });

        res.status(200).json({success: true, data: result});
    } catch (e) {
        logger.error('Documents#get: Index failure.', e);
        res.status(404).json({success: false, message: ''});
    }

};
