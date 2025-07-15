const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.get('/profile', isAuthenticated, userController.getMyProfile);
router.post('/profile', isAuthenticated, userController.updateMyProfile);

module.exports = router;
