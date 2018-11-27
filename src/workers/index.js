/**
 * Cache references to archive service child processes in this module.
 */

const {fork} = require('child_process');

const isProduction = process.env.NODE_ENV === 'production';
let debugStartPort = 9230;

const buildArgs = (args = []) => {
    let result = [].concat(args);
    if (!isProduction) result.push(`--inspect=0.0.0.0:${debugStartPort++}`);
    return result;
};

// Fork
console.info('Forking generic archiver worker proccess...');
const genericArchiveWorker = fork(process.cwd() + '/src/workers/generic/run.js', [], {execArgv: buildArgs()});

// Export references to processes
module.exports = {
    genericArchiveWorker
};
