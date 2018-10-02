'use strict';

/* global after:true, before:true, describe:true, it:true */

const assert = require('assert');
const InvoiceArchiver = require('../../../src/workers/invoice/Archiver');

// const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));

// Put your Mocha tests here and run "npm test".
describe('InvoiceArchiver', () => {

    let archiver = null;

    const eventClientMock = {
        emit: function () {
            return true;
        }
    };

    after(async () => {
    });

    before(async () => {
        archiver = new InvoiceArchiver(eventClientMock);
        await archiver.init();
    });

    describe('processReindexResult', () => {

        it('indicates failure if the result is null', () => {
            assert.strictEqual(archiver.processReindexResult(null), false);
        });

        it('indicates failure if the result is empty', () => {
            assert.strictEqual(archiver.processReindexResult({}), false);
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

            assert.strictEqual(archiver.processReindexResult(result), false);
        });

    });

    // describe('#getPrefixedTenantId()', () => {
    //     it('Should return null for invalid parameters', () => {
    //         assert.strictEqual(archiver.getPrefixedTenantId(''), null);
    //         assert.strictEqual(archiver.getPrefixedTenantId({}), null);
    //         assert.strictEqual(archiver.getPrefixedTenantId({customerId: ['a'], supplierId: ['c']}), null);
    //         assert.strictEqual(archiver.getPrefixedTenantId({customerId: '', supplierId: ''}), null);
    //     });

    //     it('Should return a prefixed tenantId for valid params', () => {
    //         assert.strictEqual(archiver.getPrefixedTenantId({customerId: 'OC001', supplierId: null}), 'c_OC001');
    //         assert.strictEqual(archiver.getPrefixedTenantId({customerId: null, supplierId: 'hard001'}), 's_hard001');
    //     });
    // });

});
