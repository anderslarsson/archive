/**
 * This module encapsulates the actual reference to forked
 * worker process. These references can be used to communicate
 * via IPC to the processes.
 */

const {fork} = require('child_process');

const isProduction = process.env.NODE_ENV === 'production';
let debugStartPort = 9230; // Start debugger sessions beginning with this port.

const buildArgs = (args = []) => {
    let result = [].concat(args);
    if (!isProduction) result.push(`--inspect=0.0.0.0:${debugStartPort++}`);
    return result;
};

// Fork workers
console.info('Forking generic archive worker proccess...');
const genericArchiveWorker = fork(process.cwd() + '/src/workers/generic/run.js', [], {execArgv: buildArgs()});

console.info('Forking invoice archiver worker proccess...');
const invoiceArchiveWorker = fork(process.cwd() + '/src/workers/invoice/run.js', [], {execArgv: []}); // @todo Move to workers module

console.info('Forking transaction log checker worker proccess...');
const transactionLogCheckWorker = fork(process.cwd() + '/src/workers/transactionLogCheck/run.js', [], {execArgv: []}); // @todo Move to workers module

module.exports = {
    genericArchiveWorker,
    invoiceArchiveWorker,
    transactionLogCheckWorker
};
