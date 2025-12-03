const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HandledComment = sequelize.define('HandledComment', {
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
    reply_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    handled_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    ai_response: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    session_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'handled_comments',
    timestamps: false,
    indexes: [
      { fields: ['comment_id'] },
      { fields: ['handled_at'] },
      { fields: ['session_id'] }
    ]
  });

  HandledComment.associate = (models) => {
    HandledComment.belongsTo(models.FacebookComment, { foreignKey: 'comment_id', targetKey: 'comment_id', as: 'comment' });
  };

  return HandledComment;
};


