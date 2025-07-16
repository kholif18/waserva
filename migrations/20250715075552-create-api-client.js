'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ApiClients', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      appName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      sessionName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      apiToken: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });
    await queryInterface.addConstraint('ApiClients', {
      fields: ['userId', 'appName'],
      type: 'unique',
      name: 'unique_user_appname' // bebas, tapi wajib unik di seluruh DB
    });
  },
  async down(queryInterface, Sequelize) {
    //await queryInterface.removeConstraint('ApiClients', 'unique_user_appname');
    await queryInterface.dropTable('ApiClients');
  }
};