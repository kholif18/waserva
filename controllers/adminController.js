const whatsappService = require('../services/whatsappService');
const {
    User,
    History
} = require('../models');
const {
    Op,
    fn,
    col
} = require('sequelize');

exports.dashboard = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const totalUsers = await User.count();

        // Jumlah permintaan API hari ini
        const apiRequestsToday = await History.count({
            where: {
                userId,
                createdAt: {
                    [Op.gte]: new Date().setHours(0, 0, 0, 0)
                },
                source: {
                    [Op.ne]: 'panel' // Atau ['panel', 'tester'] jika kamu gunakan itu
                }
            }
        });

        const totalMessages = await History.count();
        const successMessages = await History.count({
            where: {
                status: 'Success'
            }
        });
        const successRate = totalMessages ? ((successMessages / totalMessages) * 100).toFixed(1) : 0;

        // Ambil status sesi dari WhatsApp service
        const sessionStatuses = await whatsappService.getAllSessionStatus();
        const connectedUsers = sessionStatuses.filter(s => s.status === 'CONNECTED').length;

        // Ambil data jumlah pesan per hari (7 hari terakhir)
        const dailyMessages = await History.findAll({
            attributes: [
                [fn('DATE', col('createdAt')), 'date'],
                [fn('COUNT', col('id')), 'count']
            ],
            where: {
                createdAt: {
                    [Op.gte]: new Date(new Date() - 7 * 24 * 60 * 60 * 1000)
                }
            },
            group: [fn('DATE', col('createdAt'))],
            order: [
                [fn('DATE', col('createdAt')), 'ASC']
            ]
        });

        const statusCounts = await History.findAll({
            attributes: ['status', [fn('COUNT', col('status')), 'count']],
            group: ['status']
        });

        // Pie chart data
        const pieLabels = [];
        const pieData = [];
        statusCounts.forEach(item => {
            pieLabels.push(item.status);
            pieData.push(parseInt(item.dataValues.count));
        });

        // Line chart data
        const chartLabels = [];
        const chartData = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const formatted = date.toISOString().slice(0, 10);

            chartLabels.push(formatted);
            const found = dailyMessages.find(row => row.dataValues.date === formatted);
            chartData.push(found ? parseInt(found.dataValues.count) : 0);
        }

        // Render ke dashboard
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            activePage: 'dashboard',
            totalUsers,
            apiRequestsToday,
            successRate,
            connectedUsers,
            chartLabels: JSON.stringify(chartLabels),
            chartData: JSON.stringify(chartData),
            pieLabels,
            pieData,
        });
    } catch (err) {
        console.error('Gagal memuat dashboard:', err);
        req.flash('error', 'Gagal memuat dashboard.');
        res.redirect('/admin/dashboard');
    }
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
        await whatsappService.resetUserSessionById(userId);
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
        const success = await whatsappService.logoutSession(userId);

        if (success) {
            req.flash('success', `User ID ${userId} berhasil di-force logout`);
        } else {
            req.flash('error', `Gagal force logout. Mungkin sesi tidak aktif.`);
        }
    } catch (err) {
        console.error('Gagal force logout session dari admin:', err);
        req.flash('error', 'Terjadi kesalahan saat force logout');
    }

    res.redirect('/admin/sessions');
};

exports.viewAdminSettings = (req, res) => {
    const currentUser = req.session.user;

    if (!currentUser || currentUser.role !== 'admin') {
        req.flash('error', 'Akses ditolak.');
        return res.redirect('admin/dashboard');
    }

    res.render('admin/settings', {
        title: 'Pengaturan Admin',
        activePage: 'admin-settings'
    });
};