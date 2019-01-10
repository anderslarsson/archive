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

// Export references to processes
module.exports = {
    genericArchiveWorker
};
