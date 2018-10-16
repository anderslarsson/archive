const dbInit = require('@opuscapita/db-init');
const Logger = require('ocbesbn-logger');
const InvoiceWorker = require('./Worker');

const logger = new Logger({
    context: {
        serviceName: 'archive'
    }
});

async function init() {
    const db = await dbInit.init();

    const worker = new InvoiceWorker(db);
    await worker.init();

    process.on('message', (m) => {
        console.log('InvoiceWorker got message ...');

        if (m === 'print_status') {
            console.log('Eventclient: ', worker.eventClient);
            console.log('logWaitDispatcherTimeout: ', worker.logWaitDispatcherTimeout);
        }
    });
}

try {
    init();
} catch (e) {
    logger.error('Exception caught. Failed to initialize InvoiceWorker with: ', e);
}

