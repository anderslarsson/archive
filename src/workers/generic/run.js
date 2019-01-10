const dbInit = require('@opuscapita/db-init');
const Logger = require('ocbesbn-logger');

const GenericWorker = require('./GenericWorker');

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
        logger.info('GenericWorker got message ...');

        if (m === 'ping') {
            logger.info('Pong');
        }
    });
}

try {
    init();
} catch (e) {
    logger.error('Exception caught. Failed to initialize GenericWorker with: ', e);
}

