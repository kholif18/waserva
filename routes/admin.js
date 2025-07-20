const express = require('express');
const router = express.Router();
const isSystemAdmin = require('../middlewares/isSystemAdmin');
const adminController = require('../controllers/adminController');

router.get('/dashboard', isSystemAdmin, adminController.dashboard);
router.get('/session', isSystemAdmin, adminController.viewSessionList);

// router.get('/update', isSystemAdmin, adminController.showUpdatePage);
// router.post('/update', isSystemAdmin, adminController.processUpdate);

module.exports = router;
