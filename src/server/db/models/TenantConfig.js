const Sequelize = require('sequelize');

module.exports.init = function (db) {
  /**
   * Data model representing a single user item.
   * @class User
   */
  db.define('TenantConfig',
    /** @lends User */
    {
      /** Unique identifier usually concatenated of federation id ':' and user id to ensure unique user names. */
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      /** Identifier of supplier a user is assigned to. */
      tenantId: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      type: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'invoice'
      },
      retentionPeriodHot: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '30'
      },
      retentionPeriodLongTerm: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '10'
      },
      createdBy: {
        type: Sequelize.STRING(60),
        allowNull: false,
        defaultValue: 'Opuscapita user'
      },
      changedBy: {
        type: Sequelize.STRING(60),
        allowNull: false,
        defaultValue: 'Opuscapita user'
      },
      createdOn: {
        type: Sequelize.DATE(),
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      changedOn: {
        type: Sequelize.DATE(),
        allowNull: true
      }
    }, {
      hooks: {
        beforeValidate: (instance) => {
          instance.changedOn = new Date();
        }
      },
      freezeTableName: true,
      updatedAt: 'changedOn',
      createdAt: 'createdOn',
    });

  return Promise.resolve();
};

