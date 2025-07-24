const express = require('express');
const router = express.Router();

// Middleware
const isAuthenticated = require('../middlewares/isAuthenticated');
const {
    requireRole
} = require('../middlewares/roleMiddleware');

// Controllers
const dashboardController = require('../controllers/dashboardController');
const helpController = require('../controllers/helpController');
const quickSearchController = require('../controllers/quickSearchController');

// Routes
const authRoutes = require('./auth');
const apiWhatsappRoutes = require('./api/whatsapp');
const userRoutes = require('./user');
const apiClientRoutes = require('./apiClient');
const webWhatsappRoutes = require('./whatsapp');
const historyRoutes = require('./history');
const settingRoutes = require('./setting');
const reportRoutes = require('./report');
const logRoutes = require('./log');
const adminRoutes = require('./admin');

// --------------------
// PUBLIC ROUTES
// --------------------
router.use('/', authRoutes); // Login, Register
router.use('/api/whatsapp', apiWhatsappRoutes); // Public API Token Access
router.get('/quick-search', isAuthenticated, quickSearchController.search);

// --------------------
// ADMIN ROUTES (require login & admin role)
// --------------------
router.use('/admin', isAuthenticated, adminRoutes);

// --------------------
// USER ROUTES (require login & user role)
// --------------------
router.use(isAuthenticated, requireRole('user'));

router.get('/', dashboardController.viewDashboard);
router.use('/', userRoutes); // profile, dll
router.use('/api-clients', apiClientRoutes);
router.use('/settings', settingRoutes);
router.use('/wa', webWhatsappRoutes);
router.use('/history', historyRoutes);
router.use('/report', reportRoutes);
router.use('/logs', logRoutes);
router.get('/helps', helpController.index);
router.get('/helps/api', helpController.api);

router.use((req, res, next) => {
    res.status(404).render('errors/404', {
        title: 'Page Not Found',
        layout: false
    });
});

router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('errors/500', {
        title: 'Internal Server Error',
        layout: false,
    });
});


module.exports = router;
