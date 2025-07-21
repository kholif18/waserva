const bcrypt = require('bcryptjs');
const {
    User,
    Setting,
    AdminSetting,
    PasswordResetToken
} = require('../models');
const nodemailer = require('nodemailer');
const {
    Op
} = require('sequelize');
const crypto = require('crypto');
const logService = require('../services/logService');
const whatsappSessionController = require('./whatsappSessionController');
const whatsappService = require('../services/whatsappService');
const {
    getMultipleSettings
} = require('../services/adminSettingService');

// Fungsi validasi password kuat
function isStrongPassword(password) {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    return strongPasswordRegex.test(password);
}

module.exports = {
    showLogin: (req, res) => {
        const success = req.flash('success');
        const error = req.flash('error');

        res.render('auth/login', {
            layout: false,
            errors: {},
            old: {},
            success,
            error
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
        const allowReg = await AdminSetting.findOne({
            where: {
                key: 'allow_registration'
            }
        });
        if (!allowReg || allowReg.value !== 'true') {
            return res.status(403).render('errors/403', {
                layout: false,
                user: req.session.user || null,
                title: 'Registration Disabled',
                message: 'User registration is currently disabled by the administrator.'
            });
        }
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
                password: hashedPassword,
                role: 'user'
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
                profile_image: user.profile_image,
                role: user.role
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
                profile_image: user.profile_image,
                role: user.role // pastikan ada ini
            };

            // Durasi sesi
            if (remember === 'true' || remember === 'on') {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 hari
            } else {
                req.session.cookie.expires = false;
            }

            await logService.createLog({
                userId: user.id,
                level: 'INFO',
                message: `User ${user.username} logged in successfully.`
            });

            // Start WA session
            if (user.role !== 'admin') {
                whatsappSessionController.startUserSession(user.id).catch(console.error);
            }

            // Redirect berdasarkan role
            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else {
                return res.redirect('/');
            }

        } catch (err) {
            await logService.createLog({
                userId: 0,
                level: 'WARN',
                message: `Login failed for username ${username}`
            });

            return res.status(500).render('auth/login', {
                layout: false,
                errors: {
                    general: 'Terjadi kesalahan saat login'
                },
                old: {
                    username
                },
                success: req.flash('success'),
                error: req.flash('error')
            });
        }
    },


    showForgotPassword: (req, res) => {
        res.render('auth/forgot-password', {
            layout: false,
            errors: {},
            old: {},
            flashMessage: null, // <== tambah ini
            showAlert: false
        });
    },

    processForgotPassword: async (req, res) => {
        const {
            email,
            method
        } = req.body;

        const user = await User.findOne({
            where: {
                email
            }
        });

        if (!user) {
            return res.status(400).render('auth/forgot-password', {
                layout: false,
                errors: {
                    email: 'Email tidak ditemukan'
                },
                old: {
                    email
                },
                flashMessage: null,
                showAlert: false,
                redirectToLogin: false
            });
        }

        // Hapus token lama
        await PasswordResetToken.destroy({
            where: {
                userId: user.id,
                used: false,
                expiresAt: {
                    [Op.gt]: new Date()
                }
            }
        });

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 menit

        await PasswordResetToken.create({
            userId: user.id,
            token,
            expiresAt,
            used: false
        });

        const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
        const isReady = whatsappService.isClientReady(user.id);

        let flashMessage = '';
        let showAlert = true;

        if (method === 'whatsapp' && user.phone) {
            if (isReady) {
                await whatsappService.sendText(user.id, user.phone, `Permintaan reset password:\n${resetLink}`);
                flashMessage = 'Link reset password telah dikirim ke WhatsApp Anda.';
            } else {
                flashMessage = 'Sesi WhatsApp Anda belum aktif. Silakan kirim link melalui email.';
            }
        } else if (method === 'email' && user.email) {
            const smtp = await getMultipleSettings([
                'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'from_email', 'appName'
            ]);

            const transporter = nodemailer.createTransport({
                host: smtp.smtp_host,
                port: parseInt(smtp.smtp_port || 587),
                secure: smtp.smtp_secure === 'true', // true untuk SSL/TLS
                auth: {
                    user: smtp.smtp_user,
                    pass: smtp.smtp_pass
                }
            });

            await transporter.sendMail({
                from: `"${smtp.smtp_name || 'Waserva Support'}" <${smtp.from_email || smtp.smtp_user}>`,
                to: user.email,
                subject: 'Reset Password',
                html: `
                <p>Halo ${user.name || user.username},</p>
                <p>Kami menerima permintaan untuk mereset password akun Anda di <strong>Waserva</strong>.</p>
                <p>Klik link berikut untuk mengatur ulang password Anda:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p><strong>Catatan penting demi keamanan:</strong></p>
                <ul>
                    <li>Link ini hanya berlaku selama 30 menit.</li>
                    <li>Jangan bagikan link ini kepada siapa pun.</li>
                    <li>Jika Anda tidak merasa melakukan permintaan ini, abaikan saja email ini. Akun Anda tetap aman.</li>
                </ul>
                <p>Terima kasih,<br>Tim Waserva</p>
            `
            });

            flashMessage = 'Link reset password telah dikirim ke email Anda.';
        } else {
            flashMessage = 'Metode pengiriman tidak valid atau data tidak tersedia.';
        }

        return res.render('auth/forgot-password', {
            layout: false,
            errors: {},
            old: {
                email
            },
            flashMessage,
            showAlert,
            redirectToLogin: true
        });
    },

    checkEmail: async (req, res) => {
        const {
            email
        } = req.body;
        const user = await User.findOne({
            where: {
                email
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Email tidak ditemukan'
            });
        }

        return res.json({
            success: true
        });
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

        if (!password) {
            errors.password = 'Password tidak boleh kosong.';
        } else if (!isStrongPassword(password)) {
            errors.password = 'Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, angka, dan simbol (!@#$%^&*).';
        } else if (password !== confirmPassword) {
            errors.confirmPassword = 'Konfirmasi tidak cocok.';
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
