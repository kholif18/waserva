'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Log extends Model {
    static associate(models) {
      // Jika ada relasi nanti
      Log.belongsTo(models.User, {
        foreignKey: 'userId'
      });
    }
  }

  Log.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sessionName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'text',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'success',
    }
  }, {
    sequelize,
    modelName: 'Log',
  });

  return Log;
};
