'use strict';

const {Client} = require('elasticsearch');

const Logger = require('ocbesbn-logger');

const {
    ErrCodes,
    InvoiceArchiveConfig
} = require('./invoice_archive_config');

const {
    normalizeTenantId
} = require('./helpers');

const ES_HOST = process.env.ES_HOST || 'elasticsearch:9200';

class Elasticsearch {

    constructor() {
        this.logger = new Logger();

        this.defaultDocType = 'doc';

        this.conn = new Client({
            apiVersion: '5.5',
            hosts: [
                ES_HOST
            ]
        });

        this.InvoiceArchiveConfig = InvoiceArchiveConfig;
    }

    get client() {
        return this.conn;
    }

    async printClusterHealth() {
        let res;

        try {
            res = await this.conn.cluster.health({});
        } catch (e) {
            res = 'Unable to connect to cluster.';
        }

        return res;
    }

    async count(conf) {
        return this.conn.count(conf);
    }

    /**
     * Put a document into an index.
     *
     * @async
     * @function index
     * @param {object} data - document data to index
     */
    async index(index, data) {
        return this.conn.index({
            index: index,
            type: this.defaultDocType,
            body: data
        });
    }

    /**
     * List all indices for the given tenant and type.
     *
     * @async
     * @function listIndices
     * @param {String} tenantId
     * @param {String} type - The index type (invoice, order, ...)
     * @return {Promise<Array>}
     */
    async listIndices(tenantId, type) {
        if (!tenantId) {
            throw new Error('Can not build query w/o tenantId.');
        }
        if (!type) {
            throw new Error('Can not build query w/o type.');
        }

        let normalizedTenantId = normalizeTenantId(tenantId);

        let indicesPattern = '';

        switch (type) {
            case 'invoice':
                indicesPattern = `${InvoiceArchiveConfig.indexPrefix}tenant_yearly-${normalizedTenantId}-*`;
                break;

            default:
                throw new Error('Index type unknown');
        }

        return this.conn.indices.get({
            expandWildcards: 'all',
            index: indicesPattern
        });
    }

    // --- Snapshot stuff ---

    async createRepository(name) {
        return this.conn.snapshot.createRepository({
            repository: name,
            body: {
                type: 'fs',
                'settings': {
                    location: '/tmp/es_snapshots/' + name
                }
            }
        });
    }

    async createSnapshot(repositoryName, index) {
        let snapshotName = `${index}_${Date.now()}`;

        return this.conn.snapshot.create({
            repository: repositoryName,
            snapshot: snapshotName,
            waitForCompletion: true,
            body: {
                indices: index
            }
        });
    }

    async getLatestSnapshotName(repo) {
        let res = await this.conn.snapshot.get({
            repository: repo,
            snapshot: '_all'
        });

        if (res && res.snapshots && res.snapshots.length) {
            let latestSnapshot = res.snapshots.pop();

            return latestSnapshot.snapshot;
        } else {
            throw new Error('Unable to fetch snapshot list from Elasticsearch.');
        }
    }

    async restoreSnapshot(repo, index, dryRun = false) {
        let snapshotName = await this.getLatestSnapshotName(repo);

        console.log(`Restoring snapshot ${snapshotName} in repo ${repo}`);

        if (dryRun) {
            console.log('Dry run done.');
        } else {
            return this.conn.snapshot.restore({
                repository: repo,
                snapshot: snapshotName,
                waitForCompletion: true,
                body: {
                    indices: index
                }
            });
        }

        return Promise.resolve();
    }


    async deleteSnapshot(repositoryName, index) {
        return this.conn.snapshot.delete({
            repository: repositoryName,
            snapshot: index
        });
    }

    // --- Reindexing

    /**
     * @async
     * @function reindex
     *
     * Convenience function that handles a copy action from the srcIndex to the dstIndex,
     * including creation of the dstIndex and copying the mapping.
     * Callers can provide a query that will be used for the reindex operation.
     *
     * @param {String} srcIndex - Name of the source index
     * @param {String} dstIndex - Name of the index to copy to
     * @param {object} query
     *
     * @returns {Promise<object>} Object containing the result of the reindex operation coming from ES.
     */
    async reindex(srcIndexName, dstIndexName, query) {
        try {

            let dstHasSrcMapping,
                    statusSrcIndex,
                    statusDstIndex;

            statusSrcIndex = await this.openIndex(srcIndexName, false);
            if (statusSrcIndex === false) {
                let e = new Error('Source index does not exist.');
                e.code = ErrCodes.ERR_SRC_INDEX_DOES_NOT_EXIST;

                throw e;
            }

            let dstExists = await this.conn.indices.exists({index: dstIndexName});
            if (dstExists === false) {
                // Create index + copy mappings
                statusDstIndex = await this.openIndex(dstIndexName, true);

                try {
                    dstHasSrcMapping = await this.copyMapping(srcIndexName, dstIndexName, true);
                } catch (copyMappingError) {

                    // Failed to copy mapping
                    dstHasSrcMapping = false;

                    // Delete dstIndex as it has no valid mapping
                    await this.conn.indices.delete({index: dstIndexName}); // oO DANGERZONE - double check this

                    let e = new Error(`Unable to copy mapping from ${srcIndexName} to ${dstIndexName}.`);
                    throw e;
                }

            } else {
                // Use existing index
                statusDstIndex = await this.openIndex(dstIndexName, false);

                // Assuming the  dstIndex has the srcIndex mapping
                // TODO Implement check
                dstHasSrcMapping = true;
            }

            if (statusSrcIndex && statusDstIndex && dstHasSrcMapping) {
                let body = {
                    source: {
                        index: srcIndexName,
                    },
                    dest: {
                        index: dstIndexName
                    }
                };

                if (query) {
                    body.source.query = query;
                }

                // Return the actual result of the reindex action
                // to the caller.
                return await this.conn.reindex({
                    waitForCompletion: true,
                    body: body
                });
            }
        } catch (e) {
            // TODO Do something with the error?
            this.logger.error('Elasticsearch#reindex: Failed to execute reindex.', e);
            throw e;
        }

    }

    /**
     * @function getTenantIndices
     *
     * description
     *
     * @param {String} tenantId
     * @param {String} type - Type of the indices to list (monthly, yearly). Defaulst to all.
     *
     */
    async getTenantIndices(tenantId, type) {
        if (!tenantId) {
            throw new Error('Can not query w/o tenantId.');
        }

        let normalizedTenantId = normalizeTenantId(tenantId);

        let indicesPattern = InvoiceArchiveConfig.indexPrefix;

        if (type === 'monthly' || type === 'yearly') {
            indicesPattern = `${indicesPattern}tenant_${type}-${normalizedTenantId}-*`;
        } else {
            indicesPattern = `${indicesPattern}*-${normalizedTenantId}-*`;
        }

        return this.conn.indices.get({
            expandWildcards: 'all',
            index: indicesPattern
        });
    }

    /**
     *
     * Opens an existing index.
     * Will @throws if index does not exist or opening does not work.
     *
     * @async
     * @function openIndex
     * @params {String} indexName - Name of the Elasticsearch index
     * @params {Boolean} create=true - Create the index if it does not yeat exist.
     * @returns {Boolean}
     *
     * @throws  Throws if the index could not be openend
     *
     */
    async openIndex(indexName, create = false, opts = null) {
        let exists = false;
        let error = null;

        try {
            exists = await this.conn.indices.exists({index: indexName});
        } catch (e) {
            error = new Error(`Index ${indexName} does not exist`);
            error.code = ErrCodes.ERR_INDEX_DOES_NOT_EXIST;
        }

        if (exists === true && error === null) {
            // Open the index if it exists.

            try {
                let openResult = await this.conn.indices.open({
                    index: indexName
                });

                return openResult;
            } catch (e) {
                // Throw error if index can not be opened

                error = new Error(`Can not open index ${indexName}.`);
                error.code = ErrCodes.ERR_INDEX_OPEN_FAILED;
                error.indexName = indexName;

                throw error;
            }

        } else {
            // Create index or throw

            if (create) {
                await this.conn.indices.create({index: indexName});

                if (opts && opts.mapping && typeof opts.mapping === 'object') {
                    await this.conn.indices.putMapping({
                        body: opts.mapping,
                        index: indexName,
                        type: this.defaultDocType
                    });
                }

                return true;
            } else {
                return false;
            }
        }

    }

    /**
     * @function copyMapping
     *
     * Copies the event mapping from srcIndex to dstIndex.
     *
     * @param {String} srcIndex - Name of the source index
     * @param {String} dstIndex - Name of the destination index
     * @param {Boolean} shouldThrow - Identifies if the function should throw incase of an error
     *
     */
    async copyMapping(srcIndex, dstIndex, shouldThrow = false) {
        let retVal = false;

        try {
            let srcMapping = await this.conn.indices.getMapping({
                index: srcIndex,
                type: '_all'
            });

            if (srcMapping && srcMapping[srcIndex] && srcMapping[srcIndex].mappings && srcMapping[srcIndex].mappings.event) {
                retVal = await this.conn.indices.putMapping({
                    body: srcMapping[srcIndex].mappings.event,
                    index: dstIndex,
                    type: 'event'
                });
            } else {
                // Broken mapping on srcIndex
                let e = new Error(`Source index ${srcIndex} has no valid archive mapping.`);
                throw e;
            }

        } catch (e) {
            if (shouldThrow) {
                throw e;
            } else {
                retVal = false;
            }
        }

        return retVal;
    }

    search(query) {
        return this.conn.search(query);
    }

}

module.exports = new Elasticsearch();
