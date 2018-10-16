'use strict';

const {fork} = require('child_process');
const Logger = require('ocbesbn-logger'); // Logger
const server = require('@opuscapita/web-init'); // Web server
const dbInit = require('@opuscapita/db-init'); // Database

const invoiceArchiveContext = require('./invoice_archive');
const elasticsearch         = require('../shared/elasticsearch');

const isProduction = process.env.NODE_ENV === 'production';

const logger = new Logger({
    context: {
        serviceName: 'archive'
    }
});


if (isProduction) {
    logger.redirectConsoleOut(); // Force anyone using console.* outputs into Logger format.
}

/**
 * Entrypoint for the server process.
 * Setup express, initialize event subscriptions and start worker processes.
 *
 * @async
 * @function init
 */
async function init() {
    const db = await dbInit.init();

    await server.init({
        server: {
            port: process.env.port || 3031,

            enableBouncer: true,
            enableEventClient: true,

            events: {
                onStart: () => logger.info('Server ready. Allons-y!')
            },

            indexFilePath: process.cwd() + '/src/server/static/index.html',
            staticFilePath: process.cwd() + '/src/server/static/',
            indexFileRoutes: [
                '/',
                '/invoices*'
            ],

            webpack: {
                useWebpack: !isProduction,
                configFilePath: process.cwd() + '/webpack.development.config.js'
            }
        },

        routes: {
            dbInstance: db
        }
    });

    await invoiceArchiveContext.initEventSubscriptions();
    await elasticsearch.init();

    logger.info('Forking invoice archiver worker proccess...');
    const invoiceArchiveWorker = fork(process.cwd() + '/src/workers/invoice/run.js', [], {execArgv: []});
    invoiceArchiveWorker.on('exit', () => {
        logger.error('Invoice archive worker died. :(');
    });

    let args = [];
    if (!isProduction) args.push('--inspect=0.0.0.0:9230');
    logger.info('Forking transaction log checker worker proccess...');
    const transactionLogCheckWorker = fork(process.cwd() + '/src/workers/transactionLogCheck/run.js', [], {execArgv: args});
    transactionLogCheckWorker.on('exit', () => {
        logger.error('Transaction log check worker died. :(');
    });
}

(() => init().catch(console.error))();
