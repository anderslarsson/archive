const InvoiceWorker = require('./Worker');
let worker = new InvoiceWorker();

process.on('message', (m) => {
    console.log('InvoiceWorker got message ...');

    if (m === 'print_status') {
        console.log('Eventclient: ', worker.eventClient);
        console.log('logWaitDispatcherTimeout: ', worker.logWaitDispatcherTimeout);
    }
});
