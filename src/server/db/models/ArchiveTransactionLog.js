'use strict';

module.exports.init = function (db) {
    const Sequelize = db.Sequelize;

    /**
     * ArchiveTransactionLogs are used for sanity checks on archiving processing.
     * They are written once the services starts the archiving of a single transaction
     * and keeps track of the process in the log. The entries in the log can than be
     * checked against what actually went to elasticsearch.
     *
     * @class ArchiveTransactionLog 
     */
    db.define('ArchiveTransactionLog', {

        /**
         * Unique identifier that identifies a transaction.
         * UUID actually is 32 (36) chars but we need some
         * safety for improper stuff.
         */
        transactionId: {
            type: Sequelize.STRING(48),
            allowNull: false,
            primaryKey: true
        },
        /** Enum denoting the current status inside the archiving process. **/
        status: {
            type: Sequelize.ENUM('created', 'processing', 'done'),
            allowNull: false,
            defaultValue: 'created'
        },
        /** Type that denotes the target archive type. **/
        type: {
            type: Sequelize.ENUM('invoice_receiving'),
            allowNull: false,
        },
        /** User who created this entry. **/
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
