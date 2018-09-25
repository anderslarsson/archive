'use strict';

module.exports.init = function (db) {
    const Sequelize = db.Sequelize;

    db.define('ArchiveTransactionLog', {

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
