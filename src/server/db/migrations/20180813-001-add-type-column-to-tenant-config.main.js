const Sequelize = require('sequelize');

module.exports.up = async function (db) {
  return await db.queryInterface.addColumn('TenantConfig', 'type', {
    type: Sequelize.STRING(30),
    allowNull: false
  });
};

module.exports.down = async function (db) {
  return await db.queryInterface.removeColumn('TenantConfig', 'type');
};
