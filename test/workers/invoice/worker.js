'use strict';

/* global after:true, describe:true, it:true */

const assert = require('assert');
const InvoiceWorker = require('../../../src/workers/invoice/Worker');

const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));

// Put your Mocha tests here and run "npm test".
describe('InvoiceWorker', () => {

  after(async () => {
    await sleep(500);

    await InvoiceWorker.eventClient.dispose();
  });

});

