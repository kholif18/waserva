const bcrypt = require('bcryptjs');
const {
    User,
    Setting
} = require('../models');
const logService = require('../services/logService');

module.exports = {
    showLogin: (req, res) => {
        res.render('auth/login', {
            layout: false,
            errors: {}, 
            old: {}
        });
    },

    showRegister: (req, res) => {
        res.render('auth/register', {
            layout: false
        });
    },

    register: async (req, res) => {
        const {
            name,
            username,
            email,
            password
        } = req.body;
        try {
            console.log('Register attempt:', {
                name,
                username,
                email,
                password
            });

            const existingUser = await User.findOne({
                where: {
                    username
                }
            });
            if (existingUser) {
                console.log('Username already exists:', username);
                return res.status(400).send('Username sudah digunakan');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await User.create({
                name: name,
                username,
                email,
                password: hashedPassword
            });

            // Tambahkan setting default setelah user berhasil dibuat
            const defaultSettings = [{
                    key: 'timeout',
                    value: '30'
                },
                {
                    key: 'max_retry',
                    value: '3'
                },
                {
                    key: 'retry_interval',
                    value: '10'
                },
                {
                    key: 'max_queue',
                    value: '100'
                },
                {
                    key: 'rate_limit_limit',
                    value: '10'
                },
                {
                    key: 'rate_limit_decay',
                    value: '60'
                },
                {
                    key: 'country_code',
                    value: '62'
                },
            ];

            await Setting.bulkCreate(
                defaultSettings.map(s => ({
                    userId: user.id,
                    key: s.key,
                    value: s.value
                }))
            );

            console.log('User created:', user.id);

            req.session.user = {
                id: user.id,
                username: user.username
            };
            await logService.createLog({
                userId: user.id,
                level: 'INFO',
                message: `New user registered: ${user.username}`
            });
            res.redirect('/');
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).send('Gagal register');
        }
    },


    login: async (req, res) => {
        const {
            username,
            password
        } = req.body;
        try {
            const user = await User.findOne({
                where: {
                    username
                }
            });
            if (!user) {
                return res.status(400).render('auth/login', {
                    layout: false,
                    errors: {
                        username: 'Username tidak ditemukan'
                    },
                    old: {
                        username
                    }
                });
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return res.status(400).render('auth/login', {
                    layout: false,
                    errors: {
                        password: 'Password salah'
                    },
                    old: {
                        username
                    }
                });
            }

            req.session.user = {
                id: user.id,
                name: user.name,
                username: user.username,
                profile_image: user.profile_image
            };
            await logService.createLog({
                userId: user.id,
                level: 'INFO',
                message: `User ${user.username} logged in successfully.`
            });
            res.redirect('/');
        } catch (err) {
            await logService.createLog({
                userId: user?.id || 0, 
                level: 'WARN',
                message: `Login failed for email ${req.body.email}`
            });
            res.status(500).send('Login error');
        }
    },

    logout: async (req, res) => {
        const user = req.session.user;

        if (user) {
            await logService.createLog({
                userId: user.id,
                level: 'INFO',
                message: `User ${user.username} logged out.`
            });
        }

        req.session.destroy(() => {
            res.redirect('/login');
        });
    }
};
