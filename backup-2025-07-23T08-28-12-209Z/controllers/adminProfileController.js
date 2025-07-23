const logService = require('../services/logService');
const userService = require('../services/userService');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

exports.viewAdminProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await userService.getUserById(userId);

        res.render('admin/profile', {
            title: 'My Profile (Admin)',
            activePage: 'profile',
            user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading admin profile');
    }
};

exports.updateAdminProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const {
            name,
            username,
            email,
            phone,
            address,
            newpassword,
            renewpassword,
            remove_avatar
        } = req.body;

        const errors = [];

        if (!name || name.trim().length < 2) errors.push('Nama minimal 2 karakter.');
        if (!username || username.trim().length < 3) errors.push('Username minimal 3 karakter.');
        if (!email || !validator.isEmail(email)) errors.push('Email tidak valid.');

        if (newpassword) {
            if (newpassword !== renewpassword) {
                errors.push('Password baru tidak cocok dengan konfirmasi.');
            }

            const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            if (!strongPasswordRegex.test(newpassword)) {
                errors.push('Password baru harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, angka, serta simbol.');
            }
        }

        const user = await userService.getUserById(userId);

        // Cek apakah username atau email berubah
        if (username !== user.username || email !== user.email) {
            const exists = await userService.findUserByUsernameOrEmail(username, email, userId);
            if (exists) {
                if (exists.username === username) errors.push('Username sudah digunakan.');
                if (exists.email === email) errors.push('Email sudah digunakan.');
            }
        }

        if (errors.length > 0) {
            errors.forEach(e => req.flash('error', e));
            return res.redirect('/admin/profile');
        }

        const updateData = {
            name: name.trim(),
            username: username.trim(),
            email: email.trim(),
            phone: phone ? phone.trim() : null,
            address: address ? address.trim() : null
        };

        if (newpassword) {
            updateData.password = await bcrypt.hash(newpassword, 10);
        }

        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const filename = `avatar_${userId}_${Date.now()}${ext}`;
            const filepath = path.join('public/uploads', filename);

            fs.renameSync(req.file.path, filepath);
            updateData.profile_image = `/uploads/${filename}`;

            if (user.profile_image && fs.existsSync('public' + user.profile_image)) {
                fs.unlinkSync('public' + user.profile_image);
            }

            req.session.user.profile_image = updateData.profile_image;
        }

        if (remove_avatar === '1') {
            updateData.profile_image = null;
            if (user.profile_image && fs.existsSync('public' + user.profile_image)) {
                fs.unlinkSync('public' + user.profile_image);
            }
            req.session.user.profile_image = null;
        }

        await userService.updateUserProfile(userId, updateData);

        req.session.user.name = updateData.name;
        req.session.user.username = updateData.username;

        await logService.createLog({
            userId,
            level: 'INFO',
            message: `System Admin ${updateData.username} updated their profile${newpassword ? ' and changed password' : ''}.`
        });

        req.flash('success', 'Profil admin berhasil diperbarui.');
        res.redirect('/admin/profile');

    } catch (err) {
        console.error(err);
        req.flash('error', err.message || 'Gagal memperbarui profil admin');
        res.redirect('/admin/profile');
    }
};
