const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FacebookComment = sequelize.define('FacebookComment', {
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
    post_id: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    parent_comment_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    from_id: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    from_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    is_from_page: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    created_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    comment_level: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },
    fetched_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'facebook_comments',
    timestamps: false,
    indexes: [
      { fields: ['comment_id'] },
      { fields: ['post_id'] },
      { fields: ['parent_comment_id'] },
      { fields: ['created_time'] }
    ]
  });

  FacebookComment.associate = (models) => {
    FacebookComment.belongsTo(models.FacebookPost, { foreignKey: 'post_id', targetKey: 'post_id', as: 'post' });
    FacebookComment.hasOne(models.HandledComment, { foreignKey: 'comment_id', sourceKey: 'comment_id', as: 'handled' });
  };

  return FacebookComment;
};


