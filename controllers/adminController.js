const sessionManager = require('../services/sessionManager');
const whatsappService = require('../services/whatsappService');
const whatsappSessionController = require('./whatsappSessionController');
const History = require('../models').History;
const User = require('../models').User;
const {
    Op
} = require('sequelize');

exports.dashboard = async (req, res) => {
    const sessionListRaw = sessionManager.getAllSessions();
    const sessionList = Object.values(sessionListRaw);
    const totalUsers = await User.count();
    const messagesToday = await History.count({
        where: {
            createdAt: {
                [Op.gte]: new Date().setHours(0, 0, 0, 0)
            }
        }
    });

    const totalMessages = await History.count();
    const successMessages = await History.count({
        where: {
            status: 'success'
        }
    });
    const successRate = totalMessages ? ((successMessages / totalMessages) * 100).toFixed(1) : 0;

    const lastMessageEntry = await History.findOne({
        order: [
            ['createdAt', 'DESC']
        ]
    });

    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        activePage: 'dashboard',
        sessionList,
        totalUsers,
        messagesToday,
        successRate,
        lastMessage: lastMessageEntry?.message || '-'
    });
};

exports.viewSessionList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 10;

        const sessionListRaw = await whatsappService.getAllSessionStatus();
        const totalItems = sessionListRaw.length;

        const totalPages = Math.ceil(totalItems / perPage);
        const offset = (page - 1) * perPage;

        const sessionList = sessionListRaw.slice(offset, offset + perPage);

        res.render('admin/sessions', {
            title: 'Monitoring Sesi WhatsApp',
            activePage: 'admin-sessions',
            sessionList,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                perPage
            },
            req // diperlukan oleh partial paginate
        });
    } catch (err) {
        console.error('Gagal memuat sesi:', err);
        req.flash('error', 'Gagal memuat data sesi');
        res.redirect('/admin/dashboard');
    }
};

exports.resetUserSession = async (req, res) => {
    const userId = req.params.id;
    try {
        await whatsappSessionController.resetSession(userId);
        req.flash('success', `Session user ID ${userId} berhasil di-reset`);
    } catch (err) {
        console.error('Gagal reset session:', err);
        req.flash('error', 'Gagal mereset session');
    }
    res.redirect('/admin/sessions');
};

exports.forceLogoutSession = async (req, res) => {
    const userId = req.params.id;
    try {
        await whatsappSessionController.logout(userId);
        req.flash('success', `User ID ${userId} berhasil di-force logout`);
    } catch (err) {
        console.error('Gagal force logout session:', err);
        req.flash('error', 'Gagal melakukan force logout');
    }
    res.redirect('/admin/sessions');
};