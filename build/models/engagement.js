"use strict";

const {
  DataTypes
} = require('sequelize');
module.exports = sequelize => {
  const Engagement = sequelize.define('Engagement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    // optional link to parent Post
    post_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    // platform_post_id is the external id returned by the platform (fb_..., ig_...)
    platform_post_id: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    platform: {
      type: DataTypes.ENUM('facebook', 'instagram', 'twitter', 'linkedin'),
      allowNull: false
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    comments: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    shares: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    clicks: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    engagement_score: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    },
    reach: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    impressions: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    engagement_rate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    },
    last_checked_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    metadata: {
      type: DataTypes.JSON,
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
    tableName: 'engagements',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  Engagement.associate = models => {
    // Engagement belongs to a Post (optional)
    Engagement.belongsTo(models.Post, {
      foreignKey: 'post_id',
      targetKey: 'id',
      as: 'post'
    });
    // Engagement belongs to a PlatformPost (by platform_post_id)
    Engagement.belongsTo(models.PlatformPost, {
      foreignKey: 'platform_post_id',
      targetKey: 'platform_post_id',
      as: 'platformPost'
    });
  };
  return Engagement;
};