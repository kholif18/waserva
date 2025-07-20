const sessionManager = require('../services/sessionManager');
const whatsappService = require('../services/whatsappService');
const History = require('../models').History;
const User = require('../models').User;

exports.dashboard = async (req, res) => {
    const sessionList = sessionManager.getAllSessions();
    const userCount = await User.count();
    const historyCount = await History.count();

    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        activePage: 'admin_dashboard', // agar sidebar bisa aktif
        sessionList,
        userCount,
        historyCount
        // user tidak perlu dikirim jika sudah ada middleware res.locals.user
    });
};

exports.viewSessionList = async (req, res) => {
    try {
        const sessionList = await whatsappService.getAllSessionStatus();

        res.render('admin/session', {
            title: 'Monitoring Sesi WhatsApp',
            activePage: 'admin-sessions',
            sessionList // tanpa user, karena sudah ada res.locals.user
        });
    } catch (err) {
        console.error('Gagal memuat sesi:', err);
        req.flash('error', 'Gagal memuat data sesi');
        res.redirect('/admin/dashboard');
    }
};
