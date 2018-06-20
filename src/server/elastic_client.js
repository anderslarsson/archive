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
