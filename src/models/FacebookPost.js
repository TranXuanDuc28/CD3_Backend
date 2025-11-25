const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FacebookPost = sequelize.define('FacebookPost', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    post_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    page_id: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    fetched_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'facebook_posts',
    timestamps: false,
    indexes: [
      { fields: ['post_id'] },
      { fields: ['created_time'] }
    ]
  });

  FacebookPost.associate = (models) => {
    FacebookPost.hasMany(models.FacebookComment, { foreignKey: 'post_id', sourceKey: 'post_id', as: 'comments' });
  };

  return FacebookPost;
};


