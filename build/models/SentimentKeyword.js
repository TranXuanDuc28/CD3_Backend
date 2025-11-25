"use strict";

const {
  DataTypes
} = require('sequelize');
module.exports = sequelize => {
  const SentimentKeyword = sequelize.define('SentimentKeyword', {
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
    sentiment: {
      type: DataTypes.ENUM('positive', 'negative', 'neutral'),
      allowNull: false
    },
    weight: {
      type: DataTypes.DECIMAL(2, 1),
      defaultValue: 1.0
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'sentiment_keywords',
    timestamps: false,
    indexes: [{
      fields: ['sentiment']
    }, {
      fields: ['category']
    }]
  });
  return SentimentKeyword;
};