module.exports.up = async function (db) {
    let Sequelize = db.Sequelize;

    await db.queryInterface.createTable('GenericArchiverLog', {
        dayToArchive: {
            type: Sequelize.DATE(),
            allowNull: false,
            primaryKey: true
        },
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

    return true;
};

module.exports.down = async function (db) {
    return await db.queryInterface.dropTable('GenericArchiverLog');
};
