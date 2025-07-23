const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const {
    getUserSettings
} = require('../services/settingService');

router.get('/', isAuthenticated, (req, res) => {
    console.log('GET /settings accessed');
    settingController.index(req, res);
});
router.post('/save', settingController.save);
router.post('/reset', settingController.reset);

router.get('/test/:userId', async (req, res) => {
    try {
        const settings = await getUserSettings(parseInt(req.params.userId));
        res.json(settings);
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});


module.exports = router;
