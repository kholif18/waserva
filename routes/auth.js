const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const loginLimiter = require('../middlewares/loginLimiter');

// halaman login & register
router.get('/login', authController.showLogin);
router.post('/login', loginLimiter, authController.login);

// Form lupa password
router.get('/forgot-password', authController.showForgotPassword);
router.post('/forgot-password', authController.processForgotPassword);

// Form reset password (setelah verifikasi)
router.get('/reset-password/:token', authController.showResetPasswordForm);
router.post('/reset-password/:token', authController.updatePassword);

router.get('/register', authController.showRegister); 
router.post('/register', authController.register);

// logout
router.get('/logout', authController.logout);

module.exports = router;
