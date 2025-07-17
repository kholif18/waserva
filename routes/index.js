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

// User Panel
router.use('/', isAuthenticated, userRoutes);
router.get('/', isAuthenticated, dashboardController.viewDashboard);
router.use('/api-clients', isAuthenticated, apiClientRoutes);
router.use('/settings', isAuthenticated, settingRoutes);

// WhatsApp Web Integration
router.use('/wa', isAuthenticated, webWhatsappRoutes);

// History
router.use('/history', isAuthenticated, historyRoutes);

// Report
router.use('/report', isAuthenticated, reportRoutes);

// Log
router.use('/logs', isAuthenticated, logRoutes);

// Public API Endpoint (dengan API Token)
router.use('/api/whatsapp', apiWhatsappRoutes);

// Help Pages
router.get('/helps', isAuthenticated, helpController.index);
router.get('/helps/api', isAuthenticated, helpController.api);

console.log('📦 apiClientRoutes:', typeof apiClientRoutes);

module.exports = router;
