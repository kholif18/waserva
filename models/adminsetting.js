'use strict';
module.exports = (sequelize, DataTypes) => {
    const AdminSetting = sequelize.define('AdminSetting', {
        key: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        value: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {});

    return AdminSetting;
};