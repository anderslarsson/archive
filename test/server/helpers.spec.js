'use strict';

/* global after:true, beforeEach:true describe:true, it:true */

const assert = require('assert');
const helpers = require('../../src/shared/helpers');

describe('Helpers module', () =>{

    describe('normalizeTenantId', () => {

        it('Should lowcase tenant IDs', () => {
            assert.strictEqual(helpers.normalizeTenantId('OC001'), 'oc001');
        });

    });

});
