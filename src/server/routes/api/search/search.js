/**
 * Search API
 */

'use strict';

const Logger                 = require('ocbesbn-logger');
const lastDayOfYear          = require('date-fns/last_day_of_year');
const elasticContext         = require('../../../../shared/elasticsearch/elasticsearch');
const {InvoiceArchiveConfig} = require('../../../../shared/invoice_archive_config');

const logger = new Logger({
    context: {
        serviceName: 'archive'
    }
});

/**
 * Search in a given index
 *
 * TODO move to different module. It is not invoice archive specific
 *
 * @async
 * @function search
 * @param {express.Request} req
 * @param {string} req.query.index - The ES index name to search in
 * @param {object} req.body - POST data
 * @param {String} req.body.query - Query options from search form
 * @param {number} req.body.pageSize - How many items should be retrieved per page
 * @param {String} req.body.sort - Field to sort by
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.search = async function search(req, res) {
    const index = req.query.index;
    const {query, pageSize, sort} = req.body;

    let sortOptions = {};
    let sortBy    = InvoiceArchiveConfig.getSortMappingForField(sort.field) || 'start';

    let sortOrder = 'asc';
    if (sort.order && ['asc', 'desc'].includes(sort.order)) {
        sortOrder = sort.order;
    }

    sortOptions[sortBy] = {
        'order': sortOrder
    };

    let es = elasticContext.client;

    /* TODO add query.{year, to, from} validation */

    let queryOptions = {
        query: {
            bool: {
                must: []
            }
        },
        sort: [sortOptions]
    };

    /**
     * Add query options
     */

    if (query.email) {
        queryOptions.query.bool.must.push({
            bool: {
                should: [
                    {wildcard: {'receiver.protocolAttributes.from.keyword': query.email}},
                    {wildcard: {'receiver.protocolAttributes.to.keyword': query.email}},
                    {wildcard: {'sender.protocolAttributes.from.keyword': query.email}},
                    {wildcard: {'sender.protocolAttributes.to.keyword': query.email}}
                ]
            }
        });
    }

    if (query.fullText) {
        queryOptions.query.bool.must.push({
            'simple_query_string': {
                query: query.fullText || '',
                'default_operator': 'and',
                fields: [
                    '_all', // does not match subfields, thus adding keyword fields below, see analyze_wildcard for alternative approach
                    'receiver.protocolAttributes.to.keyword',
                    'receiver.protocolAttributes.from.keyword',
                    'sender.protocolAttributes.to.keyword',
                    'sender.protocolAttributes.from.keyword'
                ],
                'analyze_wildcard': true
                // 'all_fields': true // More costly alternative to explicitly providing the keyword fields
            }
        });
    }

    /**
     * Add filter options
     */

    if (query.from || query.to || query.documentNumber) {
        queryOptions.query.bool.filter = {
            bool: {
                must: []
            }
        };

        const firstOfJanuar = new Date(query.year);

        if (query.from) {
            queryOptions.query.bool.filter.bool.must.push({
                range: {
                    start: {
                        gte: query.from,
                        lte: query.to || lastDayOfYear(new Date(query.year))
                    }
                }
            });
        }

        if (query.to) {
            queryOptions.query.bool.filter.bool.must.push({
                range: {
                    end: {
                        gte: query.from || firstOfJanuar.toISOString(),
                        lte: query.to
                    }
                }
            });
        }

        if (query.documentNumber) {
            queryOptions.query.bool.filter.bool.must.push({
                match: {
                    'document.number': query.documentNumber
                }
            });
        }
    }

    try {
        let result = await es.search({
            index,
            body: queryOptions,
            size: pageSize,
            scroll: '30m'
        });

        res.status(200).json({
            success: true,
            data: {
                hits: result.hits,
                scrollId: result._scroll_id
            }
        });

    } catch (e) {
        req.opuscapita.logger.error('InvoiceArchiveHandler#search: Failed to query ES.', e);
        res.status(400).json({success: false});
    }
};

/**
 * Scroll for a given scrollId
 *
 * TODO move to different module. It is not invoice archive specific
 *
 * @async
 * @function search
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {String} req.body.scrollId - ID of the scroll API
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.scroll = async function scroll(req, res) {
    let scrollId = req.params.id;

    let es = elasticContext.client;

    try {
        let result = await es.scroll({
            scrollId,
            scroll: '30m'
        });

        res.status(200).json({
            success: true,
            data: {
                hits: result.hits,
                scrollId: result._scroll_id
            }
        });

    } catch (e) {
        logger && logger.error('InvoiceArchiveHandler#scroll: Failed to scroll with exception.', e);
        res.status(400).json({success: false});
    }
};

/**
 * Delete a scroll for by the given scrollId
 *
 * TODO move to different module. It is not invoice archive specific
 *
 * @async
 * @function search
 * @param {express.Request} req
 * @param {object} req.body - POST data
 * @param {String} req.body.scrollId - ID of the scroll API
 * @param {express.Response} res
 * @param {express.App} app
 * @param {Sequelize} db
 */
module.exports.clearScroll = async function clearScroll(req, res) {
    const scrollId = req.params.id;
    const es = elasticContext.client;

    try {
        await es.clearScroll({
            scrollId
        });

        res.status(200).json({
            success: true,
            message: 'Cleared scroll successfully.'
        });

    } catch (e) {
        logger && logger.error('InvoiceArchiveHandler#clearScroll: Failed to scroll with exception.', e);
        res.status(400).json({success: false});
    }
};

