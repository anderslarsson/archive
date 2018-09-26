module.exports.up = async function (db) {
    let Sequelize = db.Sequelize;

    await db.queryInterface.createTable('ArchiveTransactionLog', {
        /**
         * Unique identifier that identifies a transaction
         * UUID actually is 32 (36) chars but we need some
         * safety for improper stuff.
         */
        transactionId: {
            type: Sequelize.STRING(48),
            allowNull: false,
            primaryKey: true
        },
        status: {
            type: Sequelize.ENUM('created', 'processing', 'done'),
            allowNull: false,
            defaultValue: 'created'
        },
        type: {
            type: Sequelize.ENUM('invoice_receiving'),
            allowNull: false,
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

    await db.query('ALTER TABLE ArchiveTransactionLog ADD CONSTRAINT custom_unique_constraint_transactionId_type UNIQUE (transactionId, type);');

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
module.exports.down = async function (db) {
    return await db.queryInterface.dropTable('ArchiveTransactionLog');
};
