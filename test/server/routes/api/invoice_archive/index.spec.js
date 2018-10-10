/* global after:true, beforeEach:true describe:true, it:true, before: true */

'use strict';

const transactionDocument   = require('./transaction_document.json');
const archiveDocument       = require('./archive_document.json');
const invoiceArchiveHandler = require('../../../../../src/server/routes/api/invoice_archive/');
const assert                = require('assert');

const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));

describe('Invoice API module', () => {

    describe('#mapTransactionToEvent', () => {

        it('Should map a transaction document to archive document.', async () => {
            const resultingArchiveDocument = invoiceArchiveHandler.mapTransactionToEvent(transactionDocument);
            assert.deepEqual(resultingArchiveDocument, archiveDocument);
        });

    });

});

