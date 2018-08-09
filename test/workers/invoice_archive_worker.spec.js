'use strict';

/* global after:true, describe:true, it:true */

const assert = require('assert');
const CuratorWorker = require('../../src/workers/curator_worker');

const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));

// Put your Mocha tests here and run "npm test".
describe('CuratorWorker', () => {

  after(async () => {
    await sleep(500);

    await CuratorWorker.eventClient.dispose();
  });

  describe('processReindexResult', () => {

    it('indicates failure if the result is null', () => {
      assert.strictEqual(CuratorWorker.processReindexResult(null), false);
    });

    it('indicates failure if the result is empty', () => {
      assert.strictEqual(CuratorWorker.processReindexResult({}), false);
    });

    it('indicates failure if the result contains failures', () => {
      let result = {
        dstIndex: 'test',
        type: {
          scope: 'test',
          period: 'test'
        },
        reindexResult: {
          failures: ['failure']
        }
      };

      assert.strictEqual(CuratorWorker.processReindexResult(result), false);
    });

  });

  describe('#getPrefixedTenantId()', () => {
    it('Should return null for invalid parameters', () => {
      assert.strictEqual(CuratorWorker.getPrefixedTenantId(''), null);
      assert.strictEqual(CuratorWorker.getPrefixedTenantId({}), null);
      assert.strictEqual(CuratorWorker.getPrefixedTenantId({customerId: ['a'], supplierId: ['c']}), null);
      assert.strictEqual(CuratorWorker.getPrefixedTenantId({customerId: '', supplierId: ''}), null);
    });

    it('Should return a prefixed tenantId for valid params', () => {
      assert.strictEqual(CuratorWorker.getPrefixedTenantId({customerId: 'OC001', supplierId: null}), 'c_OC001');
      assert.strictEqual(CuratorWorker.getPrefixedTenantId({customerId: null, supplierId: 'hard001'}), 's_hard001');
    });
  });

});

