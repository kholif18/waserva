const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');

router.get('/', settingController.index);
router.post('/save', settingController.save);

module.exports = router;
