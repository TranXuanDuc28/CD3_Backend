const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SystemLog = sequelize.define('SystemLog', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    log_level: {
      type: DataTypes.ENUM('info', 'warning', 'error', 'debug'),
      defaultValue: 'info'
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'system_logs',
    timestamps: false,
    indexes: [
      { fields: ['log_level'] },
      { fields: ['source'] },
      { fields: ['created_at'] }
    ]
  });

  return SystemLog;
};


