"use strict";

const {
  DataTypes
} = require('sequelize');
module.exports = sequelize => {
  const ChatAIConversation = sequelize.define('ChatAIConversation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'chatai_users',
        key: 'id'
      }
    },
    message_text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    message_type: {
      type: DataTypes.ENUM('received', 'sent'),
      allowNull: false
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    facebook_message_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    conversation_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'chatai_conversations',
    timestamps: false,
    indexes: [{
      fields: ['user_id']
    }, {
      fields: ['timestamp']
    }, {
      fields: ['user_id', 'timestamp']
    }]
  });
  ChatAIConversation.associate = models => {
    // A conversation belongs to a ChatAI user
    ChatAIConversation.belongsTo(models.ChatAIUser, {
      foreignKey: 'user_id',
      targetKey: 'id',
      as: 'user'
    });
  };
  return ChatAIConversation;
};