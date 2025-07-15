const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.get('/myprofile', isAuthenticated, userController.getMyProfile);
router.post('/myprofile', isAuthenticated, userController.updateMyProfile);

module.exports = router;
