const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatAIAnalytics = sequelize.define('ChatAIAnalytics', {
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
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    event_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'chatai_analytics',
    timestamps: false,
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['event_type']
      },
      {
        fields: ['timestamp']
      },
      {
        fields: ['user_id', 'event_type', 'timestamp']
      }
    ]
  });

  ChatAIAnalytics.associate = (models) => {
    // Analytics belongs to a ChatAI user
    ChatAIAnalytics.belongsTo(models.ChatAIUser, { 
      foreignKey: 'user_id', 
      targetKey: 'id', 
      as: 'user' 
    });
  };

  return ChatAIAnalytics;
};
