/**
 * Inserts test data into existing database structures.
 * If all migrations were successul, this method will never be executed again.
 * To identify which migrations have successfully been processed, a migration's filename is used.
 *
 * @param {object} data - [Sequelize]{@link https://github.com/sequelize/sequelize} instance.
 * @param {object} config - A model property for database models and everything from [config.data]{@link https://github.com/OpusCapita/db-init} passed when running the db-initialization.
 * @returns {Promise} JavaScript Promise object.
 * @see [Applying data migrations]{@link https://github.com/OpusCapita/db-init#applying-data-migrations}
 */
module.exports.up = async function (db, config) {
    let tenantConfigs = require('../data/tenantConfigs.json');

    tenantConfigs.forEach(c => c.createdOn = new Date());

    return await db.queryInterface.bulkInsert('TenantConfig', tenantConfigs);
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
    let customerIds = [
        'OC001', 'OC002', 'c_nationalm0se000001'
    ];

    return await db.queryInterface.bulkDelete('TenantConfig', {
        id: {
            $in: customerIds
        }
    });
};
