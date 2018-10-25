'use strict';

module.exports.checkTransactionLog = async function checkTransactionLog(req, res) {

    req.opuscapita.logger.log('Triggering curator job for transaction checking.');

    let result = await req.opuscapita.eventClient.emit('archive.curator.checkTransactionLog', {
        date: Date.now()
    });

    return res.json({success: result});
};
