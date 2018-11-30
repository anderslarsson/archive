const dbInit = require('@opuscapita/db-init');
const Logger = require('ocbesbn-logger');

const GenericWorker = require('./Worker');

const logger = new Logger({
    context: {
        serviceName: 'archive'
    }
});

async function init() {
    const db = await dbInit.init();

    const worker = new GenericWorker(db);
    await worker.init();

    process.on('message', (m) => {
        console.log('GenericWorker got message ...');

        if (m === 'print_status') {
            console.log('Eventclient: ', worker.eventClient);
            console.log('logWaitDispatcherTimeout: ', worker.logWaitDispatcherTimeout);
        }
        if (m === 'ping') {
            console.log('Pong');
        }
    });
}

try {
    init();
} catch (e) {
    logger.error('Exception caught. Failed to initialize GenericWorker with: ', e);
}

