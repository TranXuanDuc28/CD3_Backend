const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatAIUser = sequelize.define('ChatAIUser', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    facebook_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    profile_pic: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'chatai_users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['facebook_id']
      }
    ]
  });

  ChatAIUser.associate = (models) => {
    // A ChatAI user can have many conversations
    ChatAIUser.hasMany(models.ChatAIConversation, { 
      foreignKey: 'user_id', 
      sourceKey: 'id', 
      as: 'conversations' 
    });
    
    // A ChatAI user can have many analytics events
    ChatAIUser.hasMany(models.ChatAIAnalytics, { 
      foreignKey: 'user_id', 
      sourceKey: 'id', 
      as: 'analytics' 
    });
  };

  return ChatAIUser;
};
