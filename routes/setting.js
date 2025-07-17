const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.get('/', isAuthenticated, (req, res) => {
    console.log('GET /settings accessed');
    settingController.index(req, res);
});
router.post('/save', settingController.save);
router.post('/reset', settingController.reset);

module.exports = router;
