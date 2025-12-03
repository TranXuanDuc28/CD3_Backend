const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AbTestVariant = sequelize.define('AbTestVariant', {
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: false
        },
        postId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        abTestId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        metrics: {
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        tableName: 'ab_test_variants',
        timestamps: true
    });

    AbTestVariant.associate = (models) => {
        AbTestVariant.belongsTo(models.AbTest, { foreignKey: 'abTestId', targetKey: 'id', as: 'abTest' });
    };

    return AbTestVariant;
};


