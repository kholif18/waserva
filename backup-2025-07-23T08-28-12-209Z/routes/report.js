const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Halaman utama report
router.get('/', reportController.index);

module.exports = router;
