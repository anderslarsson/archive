'use strict';

const elasticContext = require('../../../../shared/elasticsearch');

module.exports.getClusterHealth = async function (req, res) {
  let result = await elasticContext.printClusterHealth();
  res.send(result);
};
