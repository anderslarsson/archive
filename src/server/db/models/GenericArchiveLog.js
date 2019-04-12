module.exports.init = function (db) {
    const Sequelize = db.Sequelize;

    /**
     * Data model representing a tenant specific archiving configuration.
     * Tenants may have multiple configurations depending on what they paid for.
     *
     * @class TenantConfig
     */
    db.define('GenericArchiverLog',
        {
            dayToArchive: {
                type: Sequelize.DATE(),
                allowNull: false,
                primaryKey: true
            },
            /** BNP unique tenantId identifies customers and suppliers. Prefixed with c_ or s_. */
            tenantId: {
                type: Sequelize.STRING(32),
                allowNull: false,
                primaryKey: true
            },
            status: {
                type: Sequelize.ENUM('started', 'failed', 'finished_with_errors', 'finished'),
                allowNull: false,
                defaultValue: 'started'
            },
            docCount: {
                type: Sequelize.INTEGER(),
                allowNull: false,
                defaultValue: 0
            },
            insertCountSuccess: {
                type: Sequelize.INTEGER(),
                allowNull: false,
                defaultValue: 0
            },
            insertCountFailed: {
                type: Sequelize.INTEGER(),
                allowNull: false,
                defaultValue: 0
            },
            /** User who created this entry. */
            createdBy: {
                type: Sequelize.STRING(60),
                allowNull: false,
                defaultValue: 'Opuscapita user'
            },
            /** User who changed this entry. */
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

