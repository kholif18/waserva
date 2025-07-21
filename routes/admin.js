const express = require('express');
const router = express.Router();
const isSystemAdmin = require('../middlewares/isSystemAdmin');
const adminController = require('../controllers/adminController');
const logController = require('../controllers/adminLogController');
const profileAdminController = require('../controllers/adminProfileController');
const adminSettingController = require('../controllers/adminSettingController');

router.get('/dashboard', isSystemAdmin, adminController.dashboard);
router.get('/sessions', isSystemAdmin, adminController.viewSessionList);
router.post('/sessions/:id/reset', isSystemAdmin, adminController.resetUserSession);
router.post('/sessions/:id/force-logout', isSystemAdmin, adminController.forceLogoutSession);

router.get('/logs', isSystemAdmin, logController.viewLogPage);
router.get('/logs/data', isSystemAdmin, logController.getUserLogs);

router.get('/profile', isSystemAdmin, profileAdminController.viewAdminProfile);
router.post('/profile', isSystemAdmin, profileAdminController.updateAdminProfile);

router.get('/settings', isSystemAdmin, adminSettingController.viewSettings);
router.post('/settings/save', isSystemAdmin, adminSettingController.saveSettings);

// router.get('/update', isSystemAdmin, adminController.showUpdatePage);
// router.post('/update', isSystemAdmin, adminController.processUpdate);

module.exports = router;
