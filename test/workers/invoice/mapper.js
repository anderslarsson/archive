'use strict';

/* global after:true, before:true, describe:true, it:true */

const assert = require('assert');
const Mapper = require('../../../src/workers/invoice/Mapper');

// const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));

// Put your Mocha tests here and run "npm test".
describe('InvoiceMapper', () => {

    const uuid = '30dd879c-ee2f-11db-8314-0800200c9a66';
    const validTransactions = [
        {
            transactionId: '30dd879c-ee2f-11db-8314-0800200c9a66',
            externalReference: {
                type: 'inChannel',
                value: '128382812'
            }
        }
    ];

    describe('_buildExternalReference', () => {

        it('Should return a single entry with the reduced externalReference', () => {
            let m = new Mapper(uuid, validTransactions);
            let result = m._buildExternalReference();
            assert.deepStrictEqual(result, {
                type: 'inChannel',
                value: '128382812'
            });
        });

        it('Should return the external reference from the last valid document', () => {
            let m = new Mapper(uuid, [...validTransactions, {
                transactionId: '30dd879c-ee2f-11db-8314-0800200c9a66',
                externalReference: {
                    type: 'inChannel',
                    value: '111'
                }
            }]);

            let result = m._buildExternalReference();
            assert.deepStrictEqual(result, {
                type: 'inChannel',
                value: '111'
            });
        });

        it('Should return an empty value (null) for invalid data.', () => {
            let m = new Mapper(uuid, [{
                transactionId: '30dd879c-ee2f-11db-8314-0800200c9a66',
                externalReference: {
                    type: 'evil'
                }
            }, {
                transactionId: '30dd879c-ee2f-11db-8314-0800200c9a66',
                externalReference: {
                    value: '666'
                }
            }]);

            let result = m._buildExternalReference();
            assert.equal(result, null);
        });

    });

});

