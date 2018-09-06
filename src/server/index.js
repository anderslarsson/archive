'use strict';

const { fork } = require('child_process');
const Logger = require('ocbesbn-logger'); // Logger
const server = require('@opuscapita/web-init'); // Web server
const dbInit = require('@opuscapita/db-init'); // Database

const invoiceArchiveContext = require('./invoice_archive');

const isProduction = process.env.NODE_ENV === 'production';

const logger = new Logger({
    context: {
        serviceName: 'archive'
    }
});


if (isProduction) {
    logger.redirectConsoleOut(); // Force anyone using console.* outputs into Logger format.
}

// Basic database and web server initialization.
// See database : https://github.com/OpusCapita/db-init
// See web server: https://github.com/OpusCapita/web-init
// See logger: https://github.com/OpusCapita/logger
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
            indexFileRoutes: ['/', '/invoices'],

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

    logger.info('Forking worker proccess...');

    let args = [];
    if (!isProduction) {
        args.push('--inspect=0.0.0.0:9230');
    }
    const invoiceArchiveWorker = fork(process.cwd() + '/src/workers/invoice/run.js', [], {execArgv: args});

    invoiceArchiveWorker.on('exit', () => {
        logger.error('Invoice archive worker died. :(');
    });

}

(() => init().catch(console.error))();
