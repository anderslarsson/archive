module.exports.up = async function (db) {
  let result = await db.query(`
    UPDATE TenantConfig SET type = 'invoice' WHERE type = '' OR type IS NULL;
  `);

  return result;
};

module.exports.down = async function () {
  // NOOP because column gets deleted
  return true;
};
