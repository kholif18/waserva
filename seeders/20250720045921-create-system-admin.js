'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('admin123', 10); // Ganti dengan password yang kuat

    await queryInterface.bulkInsert('Users', [{
      name: 'System Admin',
      username: 'admin',
      email: 'admin@example.com',
      phone: null,
      address: null,
      password: hashedPassword,
      profile_image: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', {
      username: 'admin'
    }, {});
  }
};
