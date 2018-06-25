'use strict';

const elasticContext = require('../../../elasticsearch');

const validTypes = [
  'monthly',
  'yearly'
];

module.exports.listByType =  async function listByType(req, res) {
  let tenantId = req.params.tenantId;
  // TODO check that user is allowed to list tenant's indices

  let type = req.params.type;
  if (!validTypes.includes(type)) {
    return sendErrorResponse(400, 'Wrong parameters.');
  }

  try {
    let indicesList = await fetchIndicesFromEs(tenantId, type);
    return res.status(200).json(indicesList);
  } catch (e) {
    return sendErrorResponse(500, 'Unable to fetch indices from Elasticsearch.');
  }

};

async function fetchIndicesFromEs(tenantId, type = '*') {
  let indices = await elasticContext.getTenantIndices(tenantId, type);

  // Build the list of available indices
  let result = [];
  for (let index in indices) {
    result.push(index);
  }

  return result;
}

function isAdmin(req) {
  return req
    .opuscapita.userData()
    .roles
    .some(r => r === 'admin');
}

function sendErrorResponse(req, res, status = 400, msg = '') {
  return res.status(status).json({
    error: {
      message: msg
    }
  });
}

