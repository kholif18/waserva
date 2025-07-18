'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ApiClient extends Model {
    static associate(models) {
      // Setiap API Client dimiliki oleh satu User
      ApiClient.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'User'
      });
    }
  }

  ApiClient.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    appName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    apiToken: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'ApiClient',
  });

  return ApiClient;
};