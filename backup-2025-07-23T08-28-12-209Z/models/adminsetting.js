const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class AdminSetting extends Model {}
    AdminSetting.init({
        key: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        value: DataTypes.TEXT
    }, {
        sequelize,
        modelName: 'AdminSetting',
        tableName: 'AdminSettings'
    });
    return AdminSetting;
};