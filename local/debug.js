const {genericArchiveWorker} = require('../src/workers/');

genericArchiveWorker.on('exit', () => {
    console.error('Transaction log check worker died. :(');
});

setTimeout(sendPing.bind(this), 5000);

function sendPing() {
    genericArchiveWorker.send('ping');
    setTimeout(sendPing.bind(this), 5000);
}
