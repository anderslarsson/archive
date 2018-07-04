'use strict';

/* global after:true, beforeEach:true describe:true, it:true */

const assert = require('assert');
const elasticContext = require('../../src/server/elasticsearch');

const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));

// Put your Mocha tests here and run "npm test".
describe('Elasticsearch', () => {

  after(async () => {
    await sleep(500);
  });

  it('Should have a valid connection', (done) => {
    elasticContext.conn.ping({requestTimeout: 3000}, done);
  });

  describe('normalizeTenantId', () => {

    it('Should lowcase tenant IDs', () => {
      assert.strictEqual(elasticContext.normalizeTenantId('OC001'), 'oc001');
    });

  });

  describe('openIndex', () => {

    let indexName = 'archive_unit_test';

    beforeEach(async () => {
      try {
        await elasticContext.conn.indices.delete({index: indexName});
      } catch (e) {
        return true;
      }
    });

    it('Should return false if index does not exist', async () => {
      assert.strictEqual(await elasticContext.openIndex('archive_unit_test'), false);
    });

    it('Should create a new index when create=true is set', async () => {
      await elasticContext.openIndex('archive_unit_test', true);

      assert.strictEqual(await elasticContext.conn.indices.exists({index: indexName}), true);
    });

  });

  describe('copyMapping', () => {
    let srcIndexName = 'archive_unit_test_src';
    let dstIndexName = 'archive_unit_test_dst';

    let deleteIndicesFn = async () => {
      try {
        await elasticContext.conn.indices.delete({index: [srcIndexName, dstIndexName]});
      } catch (e) {
        return true;
      }
    };

    beforeEach(async () => {
      await deleteIndicesFn();
    });

    after(async () => {
      await deleteIndicesFn();
    });

    it('Should return false when the source index does not exist', async () => {
      await elasticContext.openIndex(dstIndexName, true);
      assert.strictEqual(await elasticContext.copyMapping('foo', 'bar'), false);
    });

    it('Should throw when the source index does not exist', async () => {
      await elasticContext.openIndex(dstIndexName, true);

      let hasThrown = false;

      try {
        assert.strictEqual(await elasticContext.copyMapping('foo', 'bar', true), false);
      } catch (e) {
        hasThrown = true;
      }

      assert.strictEqual(hasThrown, true);
    });

    it('Should return false when the target index does not exist', async () => {
      await elasticContext.openIndex(srcIndexName, true);
      assert.strictEqual(await elasticContext.copyMapping(srcIndexName, dstIndexName), false);
    });

    it('Should return false when the source index does not contain a valid mapping.', async () => {
      await elasticContext.openIndex(srcIndexName, true);
      await elasticContext.openIndex(dstIndexName, true);

      assert.strictEqual(await elasticContext.copyMapping(srcIndexName, dstIndexName), false);
    });

    it('Should fail when the source-mapping does not contain the event type', async () => {
    });

    it('Should succeed when source, destination and source-mapping are valid', async () => {
      await elasticContext.openIndex(srcIndexName, true);
      await elasticContext.openIndex(dstIndexName, true);

      let acknowledged = false;

      ({acknowledged} = await elasticContext.conn.indices.putMapping({
        body: {
          properties: {
            field1: {type: 'text'}
          }
        },
        index: srcIndexName,
        type: 'event'
      }));

      assert.strictEqual(acknowledged, true);

      ({acknowledged} = await elasticContext.copyMapping(srcIndexName, dstIndexName));

      assert.strictEqual(acknowledged, true);
    });

    it('Should fail when the source-mapping does not contain the event type', async () => {
      await elasticContext.openIndex(srcIndexName, true);
      await elasticContext.openIndex(dstIndexName, true);


      await elasticContext.conn.indices.putMapping({
        body: {
          properties: {
            field1: {type: 'text'}
          }
        },
        index: srcIndexName,
        type: 'failtest'
      });

      assert.strictEqual(await elasticContext.copyMapping(srcIndexName, dstIndexName), false);
    });

  });

  describe('reindex', () => {
    let srcIndexName = 'archive_unit_test_src';
    let dstIndexName = 'archive_unit_test_dst';

    let deleteIndicesFn = async () => {
      try {
        await elasticContext.conn.indices.delete({index: [srcIndexName, dstIndexName]});
      } catch (e) {
        return true;
      }
    };

    beforeEach(async () => {
      await deleteIndicesFn();
    });

    after(async () => {
      await deleteIndicesFn();
    });

    it('Should throw when src index does not exists', async () => {
      let hasThrown = false;

      try {
        await elasticContext.reindex(srcIndexName, dstIndexName);
      } catch (e) {
        hasThrown = true;
      }

      assert.strictEqual(hasThrown, true);
    });

    it('Should delete the target index in case of failures while copying the source-mapping.');

  });

});
