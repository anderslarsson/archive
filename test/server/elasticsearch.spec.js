'use strict';

/* global after:true, beforeEach:true describe:true, it:true, before: true */

const assert = require('assert');
const elasticContext = require('../../src/shared/elasticsearch');

const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));

describe('Elasticsearch', () => {

    before(async () => {
        await elasticContext.init();
    });

    after(async () => {
        await sleep(500);
    });

    it('Should have a valid connection', (done) => {
        elasticContext.conn.ping({requestTimeout: 3000}, done);
    });

    describe('openIndex', () => {

        let indexName = 'archive_unit_test';

        beforeEach(async () => {
            try {
                await elasticContext.init();
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
            let exists = await elasticContext.conn.indices.exists({index: indexName});
            assert.strictEqual(exists, true);

            return true;
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
            await elasticContext.init();
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
            await elasticContext.init();
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

    describe('listIndices', () => {
        let indices = [
            'archive_invoice_tenant_yearly-c_unittest-2014',
            'archive_invoice_tenant_yearly-c_unittest-2015',
            'archive_invoice_tenant_yearly-c_unittest-2016'
        ];

        let deleteIndicesFn = async () => {
            try {
                await elasticContext.conn.indices.delete({index: 'archive_invoice_tenant_yearly-c_unittest-*'});
            } catch (e) {
                return true;
            }
        };

        beforeEach(async () => {
            await elasticContext.init();
        });

        after(async () => {
            await deleteIndicesFn();
        });

        it('Should require a tenantId.', async () => {
            let hasThrown = false;

            try {
                await elasticContext.listIndices(null, 'invoice');
            } catch (e) {
                hasThrown = true;
            }

            assert.strictEqual(hasThrown, true);
        });

        it('Should require a type (invoice, order, ...)', async () => {
            let hasThrown = false;

            try {
                await elasticContext.listIndices('c_unittest', null);
            } catch (e) {
                hasThrown = true;
            }

            assert.strictEqual(hasThrown, true);
        });

        it('Should return the list of tenant indices for the given type.', async () => {
            let createPromises = indices.map((i) => {
                elasticContext.openIndex(i, true);
            });

            await Promise.all(createPromises);

            // TODO this may be handy for elasticContext module -> move
            let waitForCreationFn = () => {
                return new Promise((resolve, reject) => {
                    let executor = async (count) => {
                        if (count > 10) {
                            reject;
                        }

                        let p = indices.map((index) => {
                            return elasticContext.conn.indices.exists({index}).catch(reject);
                        });
                        let exists = await Promise.all(p);

                        if (exists.indexOf(false) >= 0) {
                            setTimeout(executor, 500, count++);
                        } else {
                            resolve();
                        }
                    };

                    executor(0);
                });
            };

            await waitForCreationFn(0);

            let result = await elasticContext.listIndices('c_Unittest', 'invoice');

            let indexNames = [];
            for (const prop in result) {
                indexNames.push(prop);
            }

            assert.equal(indexNames.length, 3);
        });
    });

});
