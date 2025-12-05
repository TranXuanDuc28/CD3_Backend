const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CustomerMessage = sequelize.define('CustomerMessage', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        psid: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: 'Page-Scoped ID from Facebook Messenger'
        },
        customerName: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Customer name from Facebook profile'
        },
        lastMessageAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: 'Last time customer sent a message'
        },
        messageCount: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            comment: 'Total number of messages from this customer'
        },
        platform: {
            type: DataTypes.STRING,
            defaultValue: 'facebook',
            comment: 'Platform: facebook or instagram'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Whether customer wants to receive notifications'
        }
    }, {
        tableName: 'customer_messages',
        timestamps: true,
        indexes: [
            {
                fields: ['psid']
            },
            {
                fields: ['lastMessageAt']
            },
            {
                fields: ['platform']
            }
        ]
    });

    return CustomerMessage;
};
