const dbInit = require('@opuscapita/db-init'); // Database
const Logger = require('ocbesbn-logger'); // Logger
const TransactionLogCheckWorker = require('./Worker');

const logger = new Logger({
    context: {
        serviceName: 'archive'
    }
});

async function init() {
    const db = await dbInit.init();
    const worker = new TransactionLogCheckWorker(db);
    await worker.init();

    process.on('message', (m) => {
        console.log('InvoiceWorker got message ...');

        if (m === 'print_status') {
        }
    });
}

try {
    init();
} catch (e) {
    logger.error('Exceptions caught. Failed to initialize transactionLogCheck with: ', e);
}


