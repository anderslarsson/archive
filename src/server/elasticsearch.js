const {Client} = require('elasticsearch');
const moment = require('moment');

const ES_HOST = process.env.ES_HOST || 'elasticsearch:9200';

class Elasticsearch {

  constructor() {
    this.conn = new Client({
      apiVersion: '5.5',
      hosts: [
        ES_HOST
      ]
    });
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

  async index(index, body) {
    return this.conn.index({
      index: index,
      type: '_doc',
      body: body
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
   * @function reindexGlobalDaily
   *
   * Triggers a reindex job on ES to copy all archivable
   * entries from the daily transaction index to the global
   * daily archive index.
   *
   * @returns {Promise}
   */
  async reindexGlobalDaily() {
    let yesterday = moment().subtract(1, 'days').format('YYYY.MM.DD');

    let dstIndexName = `archive_global_daily-${yesterday}`;

    let error, statusDstIndex;
    try {
      // TODO also check the existence of the source index.
      statusDstIndex = await this.openIndex(dstIndexName, true);
    } catch (e) {
      error = e;
    }

    if (statusDstIndex && !error) {
      return this.conn.reindex({
        waitForCompletion: true,
        body: {
          source: {
            index: `bn_tx_logs-${yesterday}`,
            // TODO copy only those entries with archive flag set
            // query: {
            //   term: {
            //     archive: true
            //   }
          },
          dest: {
            index: dstIndexName // Will be created if it not exists
          }
        }
      });
    } else {
      throw error;
    }
  }

  /**
   * @function reindexGlobalDailyToTenantMonthly
   *
   * Trigers the reindex operation for a single tenant to extract the
   * entries from yesterday's archive_global_daily to the archive_tenant_monthly
   * index.
   *
   * @param {String} tenantId
   * @param {Object} query
   *
   */
  async reindexGlobalDailyToTenantMonthly(tenantId, query) {
    let yesterday       = moment().subtract(1, 'days').format('YYYY.MM.DD');
    let yesterdaysmonth = moment().subtract(1, 'days').format('YYYY.MM');

    let lowerTenantId = this.normalizeTenantId(tenantId);

    let srcIndexName = `archive_global_daily-${yesterday}`;
    let dstIndexName = `archive_tenant_monthly-${lowerTenantId}-${yesterdaysmonth}`;

    let error, statusSrcIndex, statusDstIndex;
    try {
      statusSrcIndex = await this.openIndex(srcIndexName, false);
      statusDstIndex = await this.openIndex(dstIndexName, true);
    } catch (e) {
      error = e;
    }

    if (statusSrcIndex && statusDstIndex && !error) {
      let reindexResult = await this.conn.reindex({
        waitForCompletion: true,
        body: {
          source: {
            index: srcIndexName,
            query: query
          },
          dest: {
            index: dstIndexName // Will be created if it not exists
          }
        }
      });

      await this.conn.indices.close({index: dstIndexName});

      return reindexResult;
    } else {
      throw error;
    }
  }

  /**
   * @function reindexTenantMonthlyToYearly
   *
   * Trigers the reindex operation for a single tenant's  monthly
   * archive index to the tenant's yearly archive.
   *
   * @param {String} tenantId
   */
  async reindexTenantMonthlyToYearly(tenantId) {
    let yesterdaysmonth = moment().subtract(1, 'days').format('YYYY.MM');
    let yesterdaysyear  = moment().subtract(1, 'days').format('YYYY');

    let lowerTenantId = this.normalizeTenantId(tenantId);

    let srcIndexName = `archive_tenant_monthly-${lowerTenantId}-${yesterdaysmonth}`;
    let dstIndexName = `archive_tenant_yearly-${lowerTenantId}-${yesterdaysyear}`;

    let error, statusSrcIndex, statusDstIndex;
    try {
      statusSrcIndex = await this.openIndex(srcIndexName, false);
      statusDstIndex = await this.openIndex(dstIndexName, true);
    } catch (e) {
      error = e;
    }

    if (statusSrcIndex && statusDstIndex && !error) {
      await this.conn.reindex({
        waitForCompletion: true,
        body: {
          source: {
            index: srcIndexName
          },
          dest: {
            index: dstIndexName // Will be created if it not exists
          }
        }
      });

      // await this.conn.indices.close({index: srcIndexName});
      await this.conn.indices.close({index: dstIndexName});

      return true;
    } else {
      throw error;
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

    let normalizedTenantId = this.normalizeTenantId(tenantId);

    let indicesPattern = 'archive_tenant_';

    if (type === 'monthly' || type === 'yearly') {
      indicesPattern = `${indicesPattern}${type}-${normalizedTenantId}-*`;
    } else {
      indicesPattern = `${indicesPattern}*-${normalizedTenantId}-*`;
    }

    return this.conn.indices.get({
      expandWildcards: 'all',
      index: indicesPattern
    });
  }

  /**
   * @function openIndex
   *
   * Opens an existing index.
   * Will @throws if index does not exist or opening does not work.
   *
   * @params {String} indexName
   * @params {Boolean} create=true - Create the index if it does not yeat exist.
   * @returns {Boolean}
   *
   */
  async openIndex(indexName, create = true) {
    let exists = false;
    let error = null;

    try {
      exists = await this.conn.indices.exists({index: indexName});
    } catch (e) {
      error = new Error(`Index ${indexName} does not exist`);
      error.code = 'ERR_INDEX_DOES_NOT_EXIST';
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
        error.code = 'ERR_INDEX_OPEN_FAILED';
        error.indexName = indexName;

        throw error;
      }

    } else {
      // Create index or throw

      if (create) {
        return await this.conn.indices.create({index: indexName});
      } else {
        return false;
      }
    }

  }

  search(query) {
    return this.conn.search(query);
  }

  /**
   * Normalize a tenantId (to lower case) so we can use
   * it as part of the ES index name.
   *
   * ES only allows lower case index names and tenantId
   * are persisted in a case-insensitive manner -> convert to lower.
   *
   *
   */
  normalizeTenantId(tenantId) {
    let normalizedTenantId = tenantId;

    if (tenantId && tenantId.toLowerCase) {
      normalizedTenantId = tenantId.toLowerCase();
    }

    return normalizedTenantId;
  }

}

module.exports = new Elasticsearch();
