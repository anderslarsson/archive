'use strict';

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

main();
