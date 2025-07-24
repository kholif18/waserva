const {
    History,
    User,
    ApiClient
} = require('../models');
const {
    Op
} = require('sequelize');

exports.search = async (req, res) => {
    const query = (req.query.q || '').trim();
    const currentUser = req.session.user;

    if (!currentUser || !currentUser.id) {
        return res.status(403).json({
            error: 'Unauthorized'
        });
    }

    const userId = currentUser.id;
    const isAdmin = currentUser.role === 'admin';
    const results = [];

    try {
        if (isAdmin) {
            // --- Admin: Sessions keyword ---
            if (['sessions', 'sesi', 'wa-session', 'client'].includes(query.toLowerCase())) {
                results.push({
                    label: 'Monitoring semua sesi WhatsApp',
                    link: '/admin/sessions',
                    icon: 'bi-diagram-3'
                });
            }

            // --- Admin: Cari user berdasarkan nama/email/username ---
            const users = await User.findAll({
                where: {
                    [Op.or]: [{
                            name: {
                                [Op.like]: `%${query}%`
                            }
                        },
                        {
                            email: {
                                [Op.like]: `%${query}%`
                            }
                        },
                        {
                            username: {
                                [Op.like]: `%${query}%`
                            }
                        }
                    ]
                },
                limit: 5
            });

            for (const user of users) {
                results.push({
                    label: `User: ${user.name || user.username || user.email}`,
                    link: `/admin/sessions?highlight=${user.id}`,
                    icon: 'bi-person'
                });
            }

            // --- Admin: Log filter ---
            if (query.startsWith('log:')) {
                const status = query.slice(4).trim();
                if (status) {
                    results.push({
                        label: `Log status: ${status}`,
                        link: `/admin/logs?status=${encodeURIComponent(status)}`,
                        icon: 'bi-bug'
                    });
                }
            }
        } else {
            // === USER BIASA ===

            // Format: to:628xxxxxx
            if (query.startsWith('to:')) {
                const phone = query.slice(3).trim();
                if (phone.length > 3) {
                    results.push({
                        label: `Search messages to: ${phone}`,
                        link: `/history?phone=${encodeURIComponent(phone)}`,
                        icon: 'bi-telephone'
                    });
                }
            }

            // Format: msg:hello
            else if (query.startsWith('msg:')) {
                const keyword = query.slice(4).trim();
                if (keyword.length > 2) {
                    const messages = await History.findAll({
                        where: {
                            userId,
                            message: {
                                [Op.like]: `%${keyword}%`
                            }
                        },
                        limit: 5
                    });

                    for (const m of messages) {
                        results.push({
                            label: `Message: ${m.message.substring(0, 40)}...`,
                            link: `/history?highlight=${m.id}`,
                            icon: 'bi-chat-left-text'
                        });
                    }
                }
            }

            // Format: log:Success
            else if (query.startsWith('log:')) {
                const status = query.slice(4).trim();
                if (status) {
                    results.push({
                        label: `Log status: ${status}`,
                        link: `/logs?status=${encodeURIComponent(status)}`,
                        icon: 'bi-bug'
                    });
                }
            }

            // api:namaAplikasi
            else if (query.startsWith('api:')) {
                const appName = query.slice(4).trim();
                if (appName.length > 2) {
                    results.push({
                        label: `API App: ${appName}`,
                        link: `/api-clients?search=${encodeURIComponent(appName)}`,
                        icon: 'bi-plug'
                    });
                }
            }
        }

        return res.json(results);
    } catch (err) {
        console.error('Error in quickSearchController.search:', err);
        return res.status(500).json({
            error: 'Internal Server Error'
        });
    }
};
