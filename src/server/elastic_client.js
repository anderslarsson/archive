const elasticsearch = require('elasticsearch');

const ES_HOST = process.env.ES_HOST || 'elasticsearch:9200';

class ElasticClient {

  constructor () {
    this.conn = new elasticsearch.Client({
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

  info() {
    return 'Yo';
  }

  async createRepository (name) {
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

  async createSnapshot (repositoryName, index) {
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

  reindexGlobalDaily() {
    return 'ok';
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

  async deleteSnapshot (repositoryName, index) {
    return this.conn.snapshot.delete({
      repository: repositoryName,
      snapshot: index
    })
  }

  search(query) {
    return this.client.search(query);
  }

}

module.exports = new ElasticClient();
