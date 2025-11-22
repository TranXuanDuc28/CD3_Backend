const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AIPrompt = sequelize.define('AIPrompt', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    prompt_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    system_message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
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
    tableName: 'ai_prompts',
    timestamps: false
  });

  return AIPrompt;
};


