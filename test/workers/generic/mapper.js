'use strict';

/* global after:true, before:true, describe:true, it:true */

const assert = require('assert');
const GenericMapper = require('../../../src/workers/generic/GenericMapper');

const testTransaction = require('./testTransaction.json').map(i => i.event);

// const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));

// Put your Mocha tests here and run "npm test".
describe('GenericMapper', () => {

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
            const m = new GenericMapper('c_musterkunde-01', uuid, validTransactions);
            const result = m._buildExternalReference();

            assert.deepStrictEqual(result, {
                type: 'inChannel',
                value: '128382812'
            });
        });

        it('Should return the external reference from the last valid document', () => {
            const m = new GenericMapper('c_musterkunde-01', uuid, [...validTransactions, {
                transactionId: '30dd879c-ee2f-11db-8314-0800200c9a66',
                externalReference: {
                    type: 'inChannel',
                    value: '111'
                }
            }]);

            const result = m._buildExternalReference();

            assert.deepStrictEqual(result, {
                type: 'inChannel',
                value: '111'
            });
        });

        it('Should return an empty value (null) for invalid data.', () => {
            const m = new GenericMapper('c_musterkunde-01', uuid, [{
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

            const result = m._buildExternalReference();

            assert.equal(result, null);
        });

    });

    describe('_buildSender', () => {
        const mapper = new GenericMapper('c_musterkunde-01', '9C0DF78E6865485FB050A7202FA2B691siP1', testTransaction);

        it('Should build a valid sender aggregation.', () => {
            const result = mapper._buildSender();
            assert.deepEqual(result, {
                intermediator: 'Exela',
                protocolAttributes: {
                    type: 'email', from: 'inge.otto@musterkunde.de'
                }
            });
        });

    });

    describe('_buildReceiver', () => {
        const mapper = new GenericMapper('c_musterkunde-01', '9C0DF78E6865485FB050A7202FA2B691siP1', testTransaction);

        it('Should build a valid sender aggregation.', () => {
            const result = mapper._buildReceiver();
            assert.deepEqual(result, {
                intermediator: 'OpusCapita',
                target: 'c_musterkunde-01',
                protocolAttributes: {
                    type: 'email', from: 'inge.otto@musterkunde.de'
                }
            });
        });

    });

});

