const Sequelize = require('sequelize');

module.exports.up = async function (db) {
  await db.queryInterface.removeColumn('TenantConfig', 'customerId');
  await db.queryInterface.removeColumn('TenantConfig', 'supplierId');
};

module.exports.down = async function (db) {

  await db.queryInterface.addColumn('TenantConfig', 'supplierId', {
    type: Sequelize.STRING(30),
    allowNull: true
  });

  await db.queryInterface.addColumn('TenantConfig', 'customerId', {
    type: Sequelize.STRING(30),
    allowNull: true
  });

};

