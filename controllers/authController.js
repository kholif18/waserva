const bcrypt = require('bcryptjs');
const {
    User,
    Setting
} = require('../models');
const logService = require('../services/logService');
const whatsappSessionController = require('./whatsappSessionController');

// Fungsi validasi password kuat
function isStrongPassword(password) {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return strongPasswordRegex.test(password);
}

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
            layout: false,
            errors: {},
            old: {}
        });
    },

    register: async (req, res) => {
        const {
            name,
            username,
            email,
            password
        } = req.body;
        const errors = {};

        try {
            // Cek username unik
            const existingUserByUsername = await User.findOne({
                where: {
                    username
                }
            });
            if (existingUserByUsername) {
                errors.username = 'Username sudah digunakan';
            }

            // Cek email unik
            const existingUserByEmail = await User.findOne({
                where: {
                    email
                }
            });
            if (existingUserByEmail) {
                errors.email = 'Email sudah digunakan';
            }

            // Validasi password
            if (!isStrongPassword(password)) {
                errors.password = 'Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, angka, serta simbol.';
            }

            // Jika ada error, render ulang form dengan pesan error dan isi lama
            if (Object.keys(errors).length > 0) {
                return res.status(400).render('auth/register', {
                    layout: false,
                    errors,
                    old: {
                        name,
                        username,
                        email
                    }
                });
            }

            // Hash password dan buat user baru
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await User.create({
                name,
                username,
                email,
                password: hashedPassword
            });

            // Buat default setting user
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

            // Simpan user ke session
            req.session.user = {
                id: user.id,
                name: user.name,
                username: user.username,
                profile_image: user.profile_image
            };

            // Log registrasi
            await logService.createLog({
                userId: user.id,
                level: 'INFO',
                message: `New user registered: ${user.username}`
            });

            // Mulai sesi WhatsApp
            //await whatsappSessionController.startUserSession(user.id);

            res.redirect('/');
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).send('Gagal register');
        }
    },

    login: async (req, res) => {
        const {
            username,
            password,
            remember
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

            // Simpan user ke sesi (lengkap)
            req.session.user = {
                id: user.id,
                name: user.name,
                username: user.username,
                profile_image: user.profile_image
            };

            if (req.body.remember === 'true' || req.body.remember === 'on') {
                // Simpan sesi selama 30 hari
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 hari
            } else {
                // Sesi hanya aktif selama browser terbuka
                req.session.cookie.expires = false;
            }

            await logService.createLog({
                userId: user.id,
                level: 'INFO',
                message: `User ${user.username} logged in successfully.`
            });

            // Start WA session
            await whatsappSessionController.startUserSession(user.id);

            res.redirect('/');
        } catch (err) {
            await logService.createLog({
                userId: 0,
                level: 'WARN',
                message: `Login failed for username ${username}`
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

        req.session.destroy(err => {
            if (err) {
                console.error('Gagal destroy session:', err);
                return res.redirect('/');
            }
            res.clearCookie('connect.sid'); 
            res.redirect('/login');
        });
    }
};
