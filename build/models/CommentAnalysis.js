"use strict";

const {
  DataTypes
} = require('sequelize');
module.exports = sequelize => {
  const CommentAnalysis = sequelize.define('CommentAnalysis', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    comment_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    original_message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    cleaned_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_spam: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_duplicate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    duplicate_of: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    message_length: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    word_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    has_emoji: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    has_link: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    has_tag: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    language: {
      type: DataTypes.STRING(10),
      defaultValue: 'vi'
    },
    sentiment: {
      type: DataTypes.ENUM('positive', 'negative', 'neutral', 'mixed'),
      defaultValue: 'neutral'
    },
    sentiment_score: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true
    },
    confidence_score: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true
    },
    keywords: {
      type: DataTypes.JSON,
      allowNull: true
    },
    analyzed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    is_toxic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    toxic_category: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    toxic_score: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.00
    },
    moderation_action: {
      type: DataTypes.ENUM('none', 'hide', 'delete', 'manual_review'),
      defaultValue: 'none'
    },
    moderated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'comment_analysis',
    timestamps: false,
    indexes: [{
      fields: ['comment_id']
    }, {
      fields: ['sentiment']
    }, {
      fields: ['is_spam']
    }, {
      fields: ['analyzed_at']
    }, {
      fields: ['is_toxic']
    }, {
      fields: ['moderation_action']
    }]
  });
  CommentAnalysis.associate = models => {
    CommentAnalysis.belongsTo(models.FacebookComment, {
      foreignKey: 'comment_id',
      targetKey: 'comment_id',
      as: 'facebookComment'
    });
  };
  return CommentAnalysis;
};