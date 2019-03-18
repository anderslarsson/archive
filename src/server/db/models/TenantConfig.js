module.exports.init = function (db) {
    const Sequelize = db.Sequelize;

    /**
     * Data model representing a tenant specific archiving configuration.
     * Tenants may have multiple configurations depending on what they paid for.
     *
     * @class TenantConfig
     */
    db.define('TenantConfig',
        {
            /** Unique identifier. Auto-incremented integer. */
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            /** BNP unique tenantId identifies customers and suppliers. Prefixed with c_ or s_. */
            tenantId: {
                type: Sequelize.STRING(32),
                allowNull: true
            },
            /** Identifies the type of archive this tenant uses. Maybe used later on for billing. */
            type: {
                type: Sequelize.STRING(30),
                allowNull: false,
                defaultValue: 'invoice'
            },
            goLive: {
                type: Sequelize.DATE(),
                allowNull: false
            },
            /** Defines the number of *days* an archive entry should stay on the hot storage. */
            retentionPeriodHot: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: '600' // 18 months is the default case for all GDP users
            },
            /** Defines the number of *years* archives need to be kept around (on archive storage).  Archives that are older than this can be savely deleted.  */
            retentionPeriodLongTerm: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: '11'
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

