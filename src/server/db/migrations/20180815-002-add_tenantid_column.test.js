module.exports.up = async function (db) {
  let result = await db.query(`
    UPDATE TenantConfig SET tenantId = 'c_OC001' WHERE tenantId = '';
  `);

  return result;
};

module.exports.down = async function () {
  // Nothing to do here because the column will get deleted.
  return true;
};
