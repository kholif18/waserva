const express = require('express');
const router = express.Router();
const apiClientController = require('../controllers/apiClientController');

// Tidak perlu isAuthenticated di sini, sudah dibungkus dari index.js
router.get('/', apiClientController.index);
router.post('/add', apiClientController.add);
router.post('/toggle/:id', apiClientController.toggleActive);
router.post('/regenerate/:id', apiClientController.regenerate);
router.post('/delete/:id', apiClientController.delete);

module.exports = router;
