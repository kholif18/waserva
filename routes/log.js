const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

router.get('/', logController.viewLogPage);
router.get('/data', logController.getUserLogs);

module.exports = router;
