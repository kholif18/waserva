'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ApiClient extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ApiClient.init({
    userId: DataTypes.INTEGER,
    clientName: DataTypes.STRING,
    sessionName: DataTypes.STRING,
    apiToken: DataTypes.STRING,
    createdBy: DataTypes.INTEGER,
    isActive: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'ApiClient',
  });
  return ApiClient;
};