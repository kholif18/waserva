'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Seorang user bisa punya banyak API Client
      User.hasMany(models.ApiClient, {
        foreignKey: 'userId',
        as: 'apiClients'
      });
    }
  }
  User.init({
    name: DataTypes.STRING,
    username: {
      type: DataTypes.STRING,
      unique: true
    },
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    address: DataTypes.STRING,
    password: DataTypes.STRING,
    profile_image: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};