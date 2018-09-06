/**
 * Applies migrations for databse tables and data.
 * If all migrations were successul, this method will never be executed again.
 * To identify which migrations have successfully been processed, a migration's filename is used.
 *
 * @param {object} data - [Sequelize]{@link https://github.com/sequelize/sequelize} instance.
 * @param {object} config - A model property for database models and everything from [config.data]{@link https://github.com/OpusCapita/db-init} passed when running the db-initialization.
 * @returns {Promise} JavaScript Promise object.
 * @see [Applying data migrations]{@link https://github.com/OpusCapita/db-init#applying-data-migrations}
 */
module.exports.up = async function (db, config) {
    let Sequelize = db.Sequelize;

    await db.queryInterface.createTable('TenantConfig', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        tenantId: {
            type: Sequelize.STRING(30),
            allowNull: true
        },
        type: {
            type: Sequelize.STRING(30),
            allowNull: false
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
    });

    await db.queryInterface.addConstraint('TenantConfig', ['tenantId', 'type'], {
        type: 'unique',
        name: 'custom_unique_constraint_tenantId_type'
    });

    return true;
};

/**
 * Reverts all migrations for databse tables and data.
 * If the migration process throws an error, this method is called in order to revert all changes made by the up() method.
 *
 * @param {object} data - [Sequelize]{@link https://github.com/sequelize/sequelize} instance.
 * @param {object} config - A model property for database models and everything from [config.data]{@link https://github.com/OpusCapita/db-init} passed when running the db-initialization.
 * @returns {Promise} JavaScript Promise object.
 * @see [Applying data migrations]{@link https://github.com/OpusCapita/db-init#applying-data-migrations}
 */
module.exports.down = async function (db, config) {
    return await db.queryInterface.dropTable('TenantConfig');
};
