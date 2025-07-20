const express = require('express');
const router = express.Router();
const isSystemAdmin = require('../middlewares/isSystemAdmin');
const adminController = require('../controllers/adminController');

router.get('/dashboard', isSystemAdmin, adminController.dashboard);
router.get('/sessions', isSystemAdmin, adminController.viewSessionList);
router.post('/sessions/:id/reset', isSystemAdmin, adminController.resetUserSession);
router.post('/sessions/:id/force-logout', isSystemAdmin, adminController.forceLogoutSession);


// router.get('/update', isSystemAdmin, adminController.showUpdatePage);
// router.post('/update', isSystemAdmin, adminController.processUpdate);

module.exports = router;
