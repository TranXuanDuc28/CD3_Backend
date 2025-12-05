const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const NotificationLog = sequelize.define('NotificationLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        customerId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'customer_messages',
                key: 'id'
            },
            comment: 'Foreign key to CustomerMessage'
        },
        postId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'ID of Post or AbTest'
        },
        postType: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Type: post or abtest'
        },
        occasionType: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Special occasion type (Tết, Noel, etc.)'
        },
        sentAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the notification was sent'
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'pending',
            comment: 'Status: pending, sent, failed'
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Error message if failed'
        },
        messageContent: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Content of the message sent'
        }
    }, {
        tableName: 'notification_logs',
        timestamps: true,
        indexes: [
            {
                fields: ['customerId']
            },
            {
                fields: ['postId', 'postType']
            },
            {
                fields: ['status']
            },
            {
                fields: ['sentAt']
            }
        ]
    });

    NotificationLog.associate = (models) => {
        NotificationLog.belongsTo(models.CustomerMessage, {
            foreignKey: 'customerId',
            as: 'customer'
        });
    };

    return NotificationLog;
};
