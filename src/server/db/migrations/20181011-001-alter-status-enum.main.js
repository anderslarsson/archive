module.exports.up = async function (db) {
    return await db.query('ALTER TABLE ArchiveTransactionLog MODIFY COLUMN status enum(?, ?, ?, ?) NOT NULL AFTER `transactionId`;', {
        replacements: ['created', 'processing', 'done', 'failed']
    });
};

module.exports.down = async function (db) {
    return await db.query('ALTER TABLE ArchiveTransactionLog MODIFY COLUMN status enum(?, ?, ?, ?) NOT NULL AFTER `transactionId`;', {
        replacements: ['created', 'processing', 'done']
    });
};

