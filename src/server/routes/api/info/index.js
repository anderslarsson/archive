'use strict';

const ElasticClient = require('../../../elastic_client');

module.exports.getClusterHealth = async function (req, res) {
  let result = await ElasticClient.printClusterHealth();
  res.send(result);
}
