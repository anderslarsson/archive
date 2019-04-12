const TenantConfig          = require('./TenantConfig');
const ArchiveTransactionLog = require('./ArchiveTransactionLog');
const GenericArchiveLog    = require('./GenericArchiveLog');

/**
 * Initializes all required database models using Sequelize.
 *
 * @param {object} db - [Sequelize]{@link https://github.com/sequelize/sequelize} instance.
 * @param {object} config - Everything from [config.data]{@link https://github.com/OpusCapita/db-init} passed when running the db-initialization.
 * @returns {Promise} JavaScript Promise object.
 * @see [Creating database models]{@link https://github.com/OpusCapita/db-init#creating-database-models}
 */
module.exports.init = async function (db, config) {
    // Register Sequelize database models
    return Promise.all([
        ArchiveTransactionLog.init(db, config),
        GenericArchiveLog.init(db, config),
        TenantConfig.init(db, config),
    ]);
};
