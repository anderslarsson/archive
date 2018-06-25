'use strict';

const elasticContext = require('../../../elasticsearch');

async function get(req, res) {
  if (req.params.id) {
    return getById(req.params.id, req, res);
  } else {
    return getAll(req, res);
  }
}

async function getAll(req, res) {
  let isAdmin = req
    .opuscapita.userData()
    .roles
    .some(r => r === 'admin');

  try {
    let indices = await elasticContext.getTenantIndices(req.opuscapita.getTenantId(), null, isAdmin);

    // Build the list of available indices
    let result = [];
    for (let index in indices) {
      result.push(index);
    }

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({
      error: {
        message: 'Unable to fetch indices from Elasticsearch.'
      }
    });
  }
}

async function getById(id, req, res) {
  return res.status(500).send('Not implemented');
}

module.exports = {
  get: get
};
