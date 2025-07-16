const bcrypt = require('bcryptjs');
const {
    User
} = require('../models');

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

            console.log('User created:', user.id);

            req.session.user = {
                id: user.id,
                username: user.username
            };
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
                username: user.username
            };
            res.redirect('/');
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
