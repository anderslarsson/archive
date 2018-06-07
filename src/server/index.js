'use strict';

const Logger = require('ocbesbn-logger'); // Logger
const server = require('@opuscapita/web-init'); // Web server
const dbInit = require('@opuscapita/db-init'); // Database

const isProduction = (process.env.NODE_ENV === 'production');

const logger = new Logger({
  context: {
    serviceName: 'earchive'
  }
});

if(isProduction) {
  logger.redirectConsoleOut(); // Force anyone using console.* outputs into Logger format.
}

// Basic database and web server initialization.
// See database : https://github.com/OpusCapita/db-init
// See web server: https://github.com/OpusCapita/web-init
// See logger: https://github.com/OpusCapita/logger
async function init()
{
  const db = await dbInit.init();

  await server.init({
    server : {
      port : process.env.port || 3031,

      enableBouncer : false,
      enableEventClient : isProduction,

      events : {
        onStart: () => logger.info('Server ready. Allons-y!')
      },

      indexFilePath: process.cwd() + '/src/server/static/index.html',

      staticFilePath : process.cwd() + '/src/server/static/',
      webpack : {
        useWebpack : true,
        configFilePath : process.cwd() + '/webpack.development.config.js'
      }

    },

    routes : {
      dbInstance : db
    }
  });
}

(() => init().catch(console.error))();
