const {
    History,
    ApiClient
} = require('../models');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
const advancedFormat = require('dayjs/plugin/advancedFormat');
const localeId = require('dayjs/locale/id');
const {
    Op
} = require('sequelize');


dayjs.extend(localizedFormat);
dayjs.extend(advancedFormat);
dayjs.locale(localeId);

exports.viewDashboard = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const sessionName = userId.toString();

        // Status Gateway
        let gatewayStatus = {
            statusText: 'Unknown',
            statusClass: 'unknown',
            icon: 'bx-spin'
        };

        const session = global.sessions?.[sessionName];

        if (session?.status === 'connected') {
            gatewayStatus = {
                statusText: 'Connected',
                statusClass: 'connected',
                icon: 'bx-check'
            };
        } else if (session?.status === 'qr') {
            gatewayStatus = {
                statusText: 'Scan QR',
                statusClass: 'warn',    
                icon: 'bx-qr'
            };
        } else if (session?.status === 'auth_failure') {
            gatewayStatus = {
                statusText: 'Auth Failed',
                statusClass: 'disconnected',
                icon: 'bx-error'
            };
        } else if (session?.status === 'disconnected') {
            gatewayStatus = {
                statusText: 'Disconnected',
                statusClass: 'disconnected',
                icon: 'bx-x'
            };
        } else if (session?.status === 'starting') {
            gatewayStatus = {
                statusText: 'Starting',
                statusClass: 'unknown',
                icon: 'bx-loader-circle bx-spin'
            };
        } else {
            gatewayStatus = {
                statusText: 'Unknown',
                statusClass: 'unknown',
                icon: 'bx-question-mark'
            };
        }

        // Pesan Hari Ini
        const startOfDay = dayjs().startOf('day').toDate();
        const endOfDay = dayjs().endOf('day').toDate();
        console.log('Start of day:', startOfDay);
        console.log('End of day:', endOfDay);
        const messagesToday = await History.findAll({
            where: {
                userId,
                createdAt: {
                    [Op.between]: [startOfDay, endOfDay]
                }
            },
            order: [
                ['createdAt', 'DESC']
            ]
        });
        console.log('Messages today:', messagesToday.length);

        const totalToday = messagesToday.length;
        const successToday = messagesToday.filter(msg => msg.status === 'success').length;
        const successRate = totalToday > 0 ? Math.round((successToday / totalToday) * 100) : 0;

        const lastMsg = await History.findOne({
            where: {
                userId
            },
            order: [
                ['createdAt', 'DESC']
            ]
        });

        let lastMessage = null;

        if (lastMsg) {
            const status = lastMsg.status;
            const iconClass = status === 'success' ?
                'bx bx-check-circle' :
                status === 'failed' ?
                'bx bx-x-circle' :
                status === 'pending' ?
                'bx bx-time' :
                'bx bx-question-mark';

            const statusClass = status === 'success' ?
                'msg-status-success' :
                status === 'failed' ?
                'msg-status-failed' :
                status === 'pending' ?
                'msg-status-warn' :
                'msg-status-unknown';

            lastMessage = {
                sender: lastMsg.source || 'unknown',
                message: lastMsg.message,
                status: lastMsg.status,
                iconClass,
                statusClass,
                timeFormatted: dayjs(lastMsg.createdAt).format('D MMMM YYYY, HH:mm'),
                timeOnly: dayjs(lastMsg.createdAt).format('HH:mm')
            };
        }

        res.render('pages/dashboard', {
            title: 'Dashboard',
            description: 'Halaman utama Waserva',
            activePage: 'dashboard',
            user: req.session.user,
            gatewayStatus,
            messageCountToday: totalToday,
            successRate,
            lastMessage
        });

    } catch (err) {
        console.error('Error loading dashboard:', err);
        req.flash('error', 'Gagal memuat data dashboard');
        res.redirect('/');
    }
};
