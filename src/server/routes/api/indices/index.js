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

  let indices = await elasticContext.getTenantIndices(req.opuscapita.getTenantId(), null, isAdmin);

  let result = [];

  for (let index in indices) {
    result.push(index);
  }

  return res.status(200).send(result);
}

async function getById(id, req, res) {
  return res.status(500).send('Not implemented');
}

module.exports = {
  get: get
};
