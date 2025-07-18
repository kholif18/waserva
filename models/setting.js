'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Setting extends Model {
    static associate(models) {
      // associate with User if needed
      Setting.belongsTo(models.User, {
        foreignKey: 'userId'
      });
    }
  }
  Setting.init({
    userId: {
      type: DataTypes.INTEGER
    },
    key: DataTypes.STRING,
    value: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Setting',
    tableName: 'Settings',
  });
  return Setting;
};
