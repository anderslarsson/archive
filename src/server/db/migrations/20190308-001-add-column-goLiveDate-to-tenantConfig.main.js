module.exports.up = async function (db) {
    const addColumnResult = await db.query('ALTER TABLE TenantConfig ADD goLive datetime NOT NULL DEFAULT \'2000-01-01 00:00:00\' AFTER type;');
    const removeDefaultResult = await db.query('ALTER TABLE TenantConfig ALTER goLive DROP DEFAULT;')

    return true;
};

module.exports.down = async function (db, config) {
    await db.query('ALTER TABLE TenantConfig DROP COLUMN goLive;');
};

