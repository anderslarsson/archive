'use strict';

/* global describe:true, it:true */

const assert = require('assert');
const CuratorWorker = require('../../src/workers/curator_worker');

// Put your Mocha tests here and run "npm test".
describe('CuratorWorker', () => {

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

