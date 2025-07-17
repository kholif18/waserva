'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Log extends Model {
    static associate(models) {
      // Log belongs to a User
      Log.belongsTo(models.User, {
        foreignKey: 'userId'
      });
    }
  }

  Log.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    level: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'INFO'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Log',
    tableName: 'Logs',
    timestamps: true
  });

  return Log;
};
