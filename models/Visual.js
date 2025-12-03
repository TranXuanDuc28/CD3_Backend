const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Visual = sequelize.define('Visual', {
    projectId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    originalImage: {
      type: DataTypes.STRING,
      allowNull: false
    },
    variants: {
      type: DataTypes.JSON,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'visuals',
    timestamps: true
  });

  return Visual;
};