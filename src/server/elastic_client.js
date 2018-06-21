const elasticsearch = require('elasticsearch');
const moment = require('moment');

const ES_HOST = process.env.ES_HOST || 'elasticsearch:9200';

class ElasticClient {

  constructor() {
    this.conn = new elasticsearch.Client({
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
          index: `archive_global_daily-${yesterday}`
        }
      }
    });
  }

  /**
   * @function reindexTenantDaily
   *
   * Trigers the reindex operation for a single tenant to extract the
   * entries from yesterday's archive_global_daily to the archive_tenant_monthly
   * index.
   *
   * @param {String} tenantId
   * @param {Object} query
   *
   */
  async reindexTenantDaily(tenantId, query) {
    let yesterday       = moment().subtract(1, 'days').format('YYYY.MM.DD');
    let yesterdaysmonth = moment().subtract(1, 'days').format('YYYY.MM');

    // ES only allows lower case index names and tenantId
    // are persisted in a case-insensitive manner -> convert to lower.
    let lowerTenantId = tenantId.toLowerCase();

    let srcIndexName = `archive_global_daily-${yesterday}`;
    let dstIndexName = `archive_tenant_monthly-${lowerTenantId}-${yesterdaysmonth}`;

    let exists;

    try {
      exists = await this.conn.indices.exists({
        index: srcIndexName
      });
    } catch (e) {
      exists = false;
    }

    if (exists) {
      return this.conn.reindex({
        waitForCompletion: true,
        body: {
          source: {
            index: srcIndexName,
            query: query
          },
          dest: {
            index: dstIndexName 
          }
        }
      });
    } else {
      let error = new Error(`Source index ${srcIndexName} does not exist`);
      error.code = 'ERR_SOURCE_INDEX_DOES_NOT_EXIST';

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

    // ES only allows lower case index names and tenantId
    // are persisted in a case-insensitive manner -> convert to lower.
    let lowerTenantId = tenantId.toLowerCase();

    let srcIndexName = `archive_tenant_monthly-${lowerTenantId}-${yesterdaysmonth}`;
    let dstIndexName = `archive_tenant_yearly-${lowerTenantId}-${yesterdaysyear}`;

    let exists;
    try {
      exists = await this.conn.indices.exists({
        index: srcIndexName
      });
    } catch (e) {
      exists = false;
    }

    if (exists) {
      return this.conn.reindex({
        waitForCompletion: true,
        body: {
          source: {
            index: srcIndexName
          },
          dest: {
            index: dstIndexName
          }
        }
      });
    } else {
      let error = new Error(`Source index ${srcIndexName} does not exist`);
      error.code = 'ERR_SOURCE_INDEX_DOES_NOT_EXIST';

      throw error;
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

  search(query) {
    return this.conn.search(query);
  }

}

module.exports = new ElasticClient();
