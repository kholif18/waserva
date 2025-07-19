'use strict';
module.exports = (sequelize, DataTypes) => {
    const PasswordResetToken = sequelize.define('PasswordResetToken', {
        userId: DataTypes.INTEGER,
        token: DataTypes.STRING,
        expiresAt: DataTypes.DATE,
        used: DataTypes.BOOLEAN
    }, {});

    PasswordResetToken.associate = function (models) {
        PasswordResetToken.belongsTo(models.User, {
            foreignKey: 'userId'
        });
    };

    return PasswordResetToken;
};
