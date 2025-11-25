"use strict";

const {
  DataTypes
} = require("sequelize");
module.exports = sequelize => {
  const AbTest = sequelize.define("AbTest", {
    type: {
      type: DataTypes.STRING,
      allowNull: true
    },
    projectId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM("running", "completed"),
      allowNull: false,
      defaultValue: "running"
    },
    data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    bestVariantId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    platformPostIds: {
      type: DataTypes.JSON,
      allowNull: true
    },
    slides: {
      type: DataTypes.JSON,
      allowNull: true
    },
    checked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    notifyEmail: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: "ab_tests",
    timestamps: true
  });

  // Associations
  AbTest.associate = models => {
    // An AbTest has many variants
    AbTest.hasMany(models.AbTestVariant, {
      foreignKey: "abTestId",
      sourceKey: "id",
      as: "variants"
    });
  };
  return AbTest;
};