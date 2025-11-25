"use strict";

const {
  DataTypes
} = require('sequelize');
module.exports = sequelize => {
  const ModerationLog = sequelize.define('ModerationLog', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    comment_id: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    action: {
      type: DataTypes.ENUM('hide', 'delete', 'restore', 'manual_review'),
      allowNull: false
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    performed_by: {
      type: DataTypes.STRING(50),
      defaultValue: 'system'
    },
    performed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    success: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'moderation_log',
    timestamps: false,
    indexes: [{
      fields: ['comment_id']
    }, {
      fields: ['action']
    }, {
      fields: ['performed_at']
    }]
  });
  ModerationLog.associate = models => {
    ModerationLog.belongsTo(models.FacebookComment, {
      foreignKey: 'comment_id',
      targetKey: 'comment_id',
      as: 'comment'
    });
  };
  return ModerationLog;
};