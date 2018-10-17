'use strict';

const path   = require('path');
const dotenv = require('dotenv');
const args   = require('minimist')(process.argv.slice(2));

const IkeaCustomerBuilder = require('./lib/IkeaCustomerBuilder');
const SiemensCustomerBuilder = require('./lib/SiemensCustomerBuilder');
const ProcountorCustomerBuilder = require('./lib/ProcountorCustomerBuilder');

async function main() {
    try {
        let ikea = new IkeaCustomerBuilder();
        let siemens = new SiemensCustomerBuilder();
        let pc = new ProcountorCustomerBuilder();

        await ikea.init();
        await siemens.init();
        await pc.init();

        /* Create mapping for customers */
        let ikeaResult       = await ikea.run();
        let siemensResult   = await siemens.run();
        let procountorResult = await pc.run();

        await ikea.createArchiveConfig(ikeaResult);
        await siemens.createArchiveConfig(siemensResult);
        await pc.createArchiveConfig(procountorResult);

        debugger;
    } catch (e) {
        debugger;
    }
}

if (!process.env.TARGET_ENV) {
    process.env.TARGET_ENV = 'devbox';
}

let env = dotenv.config({path: path.resolve(process.cwd(), '.env.local')});
if (env.error) {
    const msg = 'Failed to load secrects from ENV. Can not login.';
    console.log(msg);
    throw new Error(msg);
}

main();
