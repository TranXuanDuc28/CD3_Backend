const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SpamPattern = sequelize.define('SpamPattern', {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    pattern_type: { type: DataTypes.ENUM('keyword','regex','domain','phone'), allowNull: false },
    pattern_value: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'spam_patterns',
    timestamps: false,
    indexes: [
      { fields: ['pattern_type'] },
      { fields: ['is_active'] }
    ]
  });

  
  return SpamPattern;
};


