const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Post = sequelize.define('Post', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    topic: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft','scheduled', 'pending', 'published', 'failed'),
      defaultValue: 'draft'
    },
    useAI: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'use_ai'
    },
    quality_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    media: {
      type: DataTypes.JSON,
      allowNull: true
    },
    campaign: {
      type: DataTypes.JSON,
      allowNull: true
    },
    platform: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    cta: {
      type: DataTypes.JSON,
      allowNull: true
    },
    platform_post_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    published_at: {
      type: DataTypes.DATE,
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
    tableName: 'posts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
    Post.associate = (models) => {
      // A Post can have many PlatformPosts (one per social platform/variant)
      Post.hasMany(models.PlatformPost, { foreignKey: 'post_id', sourceKey: 'id', as: 'platformPosts' });
      // A Post can have many Engagement records (aggregate per platform_post)
      Post.hasMany(models.Engagement, { foreignKey: 'post_id', sourceKey: 'id', as: 'engagements' });
    };

  return Post;
};