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

});

