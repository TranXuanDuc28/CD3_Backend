const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatHistory = sequelize.define('ChatHistory', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    session_id: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    user_id: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    user_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    user_message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    ai_response: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    context_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'chat_history',
    timestamps: false,
    indexes: [
      { fields: ['session_id'] },
      { fields: ['user_id'] },
      { fields: ['created_at'] }
    ]
  });

  return ChatHistory;
};


