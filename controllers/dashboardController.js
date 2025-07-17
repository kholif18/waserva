const {
    History,
    ApiClient
} = require('../models');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
const advancedFormat = require('dayjs/plugin/advancedFormat');
const localeId = require('dayjs/locale/id');

dayjs.extend(localizedFormat);
dayjs.extend(advancedFormat);
dayjs.locale(localeId);

exports.viewDashboard = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const sessionName = userId.toString();

        // 🔌 Status Gateway
        let gatewayStatus = {
            statusText: 'Unknown',
            statusClass: 'unknown',
            icon: 'bx-spin'
        };

        const client = global.clients?.get(sessionName);
        const isReady = client && client._status === 'CONNECTED';

        if (isReady) {
            gatewayStatus = {
                statusText: 'Connected',
                statusClass: 'connected',
                icon: 'bx-check'
            };
        } else if (client) {
            gatewayStatus = {
                statusText: client._status || 'Disconnected',
                statusClass: 'disconnected',
                icon: 'bx-x'
            };
        }

        // 📊 Pesan Hari Ini
        const startOfDay = dayjs().startOf('day').toDate();
        const endOfDay = dayjs().endOf('day').toDate();

        const messagesToday = await History.findAll({
            where: {
                userId,
                createdAt: {
                    $between: [startOfDay, endOfDay]
                }
            },
            order: [
                ['createdAt', 'DESC']
            ]
        });

        const totalToday = messagesToday.length;
        const successToday = messagesToday.filter(msg => msg.status === 'success').length;
        const successRate = totalToday > 0 ? Math.round((successToday / totalToday) * 100) : 0;

        const lastMsg = messagesToday[0];
        let lastMessage = {
            sender: 'Waserva',
            message: null,
            status: 'unknown',
            timeFormatted: '-',
            timeOnly: '-'
        };

        if (lastMsg) {
            // ⬇️ Default sender = username
            let sender = req.session.user.username || 'Tester';

            // ⬇️ Jika type = api, ambil nama dari ApiClient
            if (lastMsg.type === 'api' && lastMsg.sessionName) {
                const apiClient = await ApiClient.findOne({
                    where: {
                        sessionName: lastMsg.sessionName,
                        userId
                    }
                });

                if (apiClient) sender = apiClient.appName;
            }

            lastMessage = {
                sender,
                message: lastMsg.message,
                status: lastMsg.status,
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
