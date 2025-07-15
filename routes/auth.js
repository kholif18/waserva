const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// halaman login & register
router.get('/login', authController.showLogin); // ✅ cocok dengan isi controller
router.post('/login', authController.login);

router.get('/register', authController.showRegister); // ✅ cocok juga
router.post('/register', authController.register);

// logout
router.get('/logout', authController.logout);

module.exports = router;
