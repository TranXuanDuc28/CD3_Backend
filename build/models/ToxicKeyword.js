"use strict";

const {
  DataTypes
} = require('sequelize');
module.exports = sequelize => {
  const ToxicKeyword = sequelize.define('ToxicKeyword', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    keyword: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    category: {
      type: DataTypes.ENUM('hate_speech', 'profanity', 'violence', 'sexual', 'insult'),
      allowNull: false
    },
    severity: {
      type: DataTypes.DECIMAL(2, 1),
      defaultValue: 1.0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'toxic_keywords',
    timestamps: false,
    indexes: [{
      fields: ['category']
    }, {
      fields: ['is_active']
    }]
  });
  return ToxicKeyword;
};