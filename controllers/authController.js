const bcrypt = require('bcryptjs');
const {
    User,
    Setting,
    PasswordResetToken
} = require('../models');
const crypto = require('crypto');
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

            res.redirect('/');
            // Mulai sesi WhatsApp dibelakang layar
            process.nextTick(() => {
                whatsappSessionController.startUserSession(user.id)
                    .catch(err => {
                        console.error('WA session error:', err);
                    });
            });
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).render('auth/register', {
                layout: false,
                errors: {
                    general: 'Terjadi kesalahan saat registrasi'
                },
                old: {
                    name,
                    username,
                    email
                }
            });
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
            whatsappSessionController.startUserSession(user.id)
            .catch(err => {
                console.error('WA session error:', err);
            });

            res.redirect('/');
        } catch (err) {
            await logService.createLog({
                userId: 0,
                level: 'WARN',
                message: `Login failed for username ${username}`
            });

            res.status(500).render('auth/login', {
                layout: false,
                errors: {
                    general: 'Terjadi kesalahan saat login'
                },
                old: {
                    username,
                }
            });

        }
    },

    showForgotPassword: (req, res) => {
        res.render('auth/forgot-password', {
            layout: false,
            errors: {},
            old: {}
        });
    },

    processForgotPassword: async (req, res) => {
        const {
            username
        } = req.body;
        const user = await User.findOne({
            where: {
                username
            }
        });

        if (!user) {
            return res.status(400).render('auth/forgot-password', {
                layout: false,
                errors: {
                    username: 'Username tidak ditemukan'
                },
                old: {
                    username
                }
            });
        }

        // Buat token acak
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 menit

        // Simpan token
        await PasswordResetToken.create({
            userId: user.id,
            token,
            expiresAt,
            used: false
        });

        const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;

        // 🚧 Kirim link ke email atau tampilkan langsung (sementara)
        console.log(`🔗 Reset link: ${resetLink}`);

        req.flash('success', 'Link reset password berhasil dibuat (lihat console).');
        res.redirect('/login');
    },

    showResetPasswordForm: async (req, res) => {
        const {
            token
        } = req.params;

        const record = await PasswordResetToken.findOne({
            where: {
                token,
                used: false
            }
        });

        if (!record || record.expiresAt < new Date()) {
            req.flash('error', 'Token tidak valid atau sudah kedaluwarsa.');
            return res.redirect('/login');
        }

        res.render('auth/reset-password', {
            layout: false,
            userId: record.userId,
            token,
            errors: {}
        });
    },

    updatePassword: async (req, res) => {
        const {
            token
        } = req.params;
        const {
            password,
            confirmPassword
        } = req.body;
        const errors = {};

        const record = await PasswordResetToken.findOne({
            where: {
                token,
                used: false
            }
        });

        if (!record || record.expiresAt < new Date()) {
            req.flash('error', 'Token tidak valid atau sudah kedaluwarsa.');
            return res.redirect('/login');
        }

        if (!password || password.length < 8) {
            errors.password = 'Password minimal 8 karakter.';
        } else if (password !== confirmPassword) {
            errors.confirmPassword = 'Konfirmasi tidak cocok.';
        } else if (!isStrongPassword(password)) {
            errors.password = 'Password harus mengandung huruf besar, kecil, angka, dan simbol.';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).render('auth/reset-password', {
                layout: false,
                userId: record.userId,
                token,
                errors
            });
        }

        const hashed = await bcrypt.hash(password, 10);

        const updated = await User.update({
            password: hashed
        }, {
            where: {
                id: record.userId
            }
        });

        if (updated[0] === 0) {
            req.flash('error', 'Gagal menyimpan password baru.');
            return res.redirect('/login');
        }

        // Tandai token sudah digunakan
        record.used = true;
        await record.save();

        await logService.createLog({
            userId: record.userId,
            level: 'INFO',
            message: 'Password user berhasil direset via token.'
        });

        req.flash('success', 'Password berhasil diubah. Silakan login.');
        res.redirect('/login');
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
