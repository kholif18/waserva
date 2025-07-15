const bcrypt = require('bcryptjs');
const {
    User
} = require('../models');

module.exports = {
    showLogin: (req, res) => {
        res.render('auth/login', {
            layout: false
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
            const existingUser = await User.findOne({
                where: {
                    username
                }
            });
            if (existingUser) {
                return res.status(400).send('Username sudah digunakan');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await User.create({
                full_name: name,
                username,
                email,
                password: hashedPassword
            });

            req.session.user = {
                id: user.id,
                username: user.username
            };
            res.redirect('/dashboard');
        } catch (err) {
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
            if (!user) return res.status(400).send('User tidak ditemukan');

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return res.status(400).send('Password salah');

            req.session.user = {
                id: user.id,
                username: user.username
            };
            res.redirect('/dashboard');
        } catch (err) {
            res.status(500).send('Login error');
        }
    },

    logout: (req, res) => {
        req.session.destroy(() => {
            res.redirect('/login');
        });
    }
};
