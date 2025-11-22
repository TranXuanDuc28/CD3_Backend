const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PlatformPost = sequelize.define('PlatformPost', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  post_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'posts',
      key: 'id'
    }
  },
  platform: {
    type: DataTypes.ENUM('facebook', 'instagram', 'twitter', 'linkedin'),
    allowNull: false
  },
  platform_post_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  hashtags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  post_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  aspect_ratio: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  best_time: {
    type: DataTypes.ENUM('morning', 'afternoon', 'evening'),
    defaultValue: 'morning'
  },
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high'),
    defaultValue: 'normal'
  },
  status: {
    type: DataTypes.ENUM('pending', 'published', 'failed', 'scheduled'),
    defaultValue: 'pending'
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  checked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Đánh dấu đã lấy engagement data'
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
  tableName: 'platform_posts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['post_id']
    },
    {
      fields: ['platform']
    },
    {
      fields: ['status']
    },
    {
      fields: ['platform_post_id']
    }
  ]
});

  PlatformPost.associate = (models) => {
    // PlatformPost belongs to a Post
    PlatformPost.belongsTo(models.Post, { foreignKey: 'post_id', targetKey: 'id', as: 'post' });
    // PlatformPost can have many Engagement records
    PlatformPost.hasMany(models.Engagement, { foreignKey: 'platform_post_id', sourceKey: 'platform_post_id', as: 'engagements' });
  };

  return PlatformPost;
};