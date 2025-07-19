const logService = require('../services/logService');
const userService = require('../services/userService');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

exports.getMyProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await userService.getUserById(userId);

        res.render('pages/profile', {
            title: 'My Profile',
            activePage: 'profile',
            user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading profile');
    }
};

exports.updateMyProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const {
            name,
            username,
            phone,
            email,
            address,
            newpassword,
            renewpassword,
            remove_avatar
        } = req.body;

        const errors = [];

        // Validasi nama
        if (!name || name.trim().length < 2) {
            errors.push('Nama minimal 2 karakter.');
        }

        // Validasi username
        if (!username || username.trim().length < 3) {
            errors.push('Username minimal 3 karakter.');
        }

        // Validasi email
        if (!email || !validator.isEmail(email)) {
            errors.push('Email tidak valid.');
        }

        // Validasi password baru jika diisi
        if (newpassword) {
            if (newpassword !== renewpassword) {
                errors.push('Password baru tidak cocok dengan konfirmasi.');
            }

            const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            if (!strongPasswordRegex.test(newpassword)) {
                errors.push('Password baru harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, angka, serta simbol.');
            }
        }

        // Ambil user saat ini
        const user = await userService.getUserById(userId);

        // Cek username dan email unik jika berubah
        if (username !== user.username || email !== user.email) {
            const exists = await userService.findUserByUsernameOrEmail(username, email, userId);
            if (exists) {
                if (exists.username === username) errors.push('Username sudah digunakan.');
                if (exists.email === email) errors.push('Email sudah digunakan.');
            }
        }

        // Jika ada error, tampilkan flash
        if (errors.length > 0) {
            errors.forEach(e => req.flash('error', e));
            return res.redirect('/profile');
        }

        // Siapkan data update
        const updateData = {
            name: name.trim(),
            username: username.trim(),
            phone: phone ? phone.trim() : null,
            email: email.trim(),
            address: address ? address.trim() : null
        };

        // Password hash jika ada
        if (newpassword) {
            updateData.password = await bcrypt.hash(newpassword, 10);
        }

        // Handle avatar upload
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

        // Handle avatar removal
        if (remove_avatar === '1') {
            updateData.profile_image = null;
            if (user.profile_image && fs.existsSync('public' + user.profile_image)) {
                fs.unlinkSync('public' + user.profile_image);
            }
            req.session.user.profile_image = null;
        }

        // Simpan ke DB
        await userService.updateUserProfile(userId, updateData);

        // Update sesi
        req.session.user.name = updateData.name;
        req.session.user.username = updateData.username;

        await logService.createLog({
            userId,
            level: 'INFO',
            message: `User ${updateData.username} updated profile${newpassword ? ' and changed password' : ''}.`
        });

        req.flash('success', 'Profil berhasil diperbarui.');
        res.redirect('/profile');

    } catch (err) {
        console.error(err);
        req.flash('error', err.message || 'Gagal memperbarui profil');
        res.redirect('/profile');
    }
};