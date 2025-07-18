const express = require('express');
const router = express.Router();

// Middleware
const isAuthenticated = require('../middlewares/isAuthenticated');

// Route Groups
const authRoutes = require('./auth');
const dashboardController = require('../controllers/dashboardController');
const userRoutes = require('./user');
const apiClientRoutes = require('./apiClient');
const apiWhatsappRoutes = require('./api/whatsapp');
const webWhatsappRoutes = require('./whatsapp');
const historyRoutes = require('./history');
const settingRoutes = require('./setting');
const reportRoutes = require('./report');
const logRoutes = require('./log');
const helpController = require('../controllers/helpController');

// Authentication
router.use('/', authRoutes);

// ✅ Public API Endpoint (dengan API Token) — letakkan SEBELUM middleware `isAuthenticated`
router.use('/api/whatsapp', apiWhatsappRoutes);

// 🔐 Semua route setelah ini butuh login
router.use('/', isAuthenticated, userRoutes);
router.get('/', isAuthenticated, dashboardController.viewDashboard);
router.use('/api-clients', isAuthenticated, apiClientRoutes);
router.use('/settings', isAuthenticated, settingRoutes);
router.use('/wa', isAuthenticated, webWhatsappRoutes);
router.use('/history', isAuthenticated, historyRoutes);
router.use('/report', isAuthenticated, reportRoutes);
router.use('/logs', isAuthenticated, logRoutes);

// Help Pages
router.get('/helps', isAuthenticated, helpController.index);
router.get('/helps/api', isAuthenticated, helpController.api);

module.exports = router;
