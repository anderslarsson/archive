'use strict';

const elasticContext = require('../../../elasticsearch');

module.exports.getClusterHealth = async function (req, res) {
  let result = await elasticContext.printClusterHealth();
  res.send(result);
};
