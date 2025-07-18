const logService = require('../services/logService');
const userService = require('../services/userService');
const fs = require('fs');
const path = require('path');

exports.getMyProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await userService.getUserById(userId);

        res.render('pages/profile', {
            title: 'My Profile',
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

        if (newpassword && newpassword !== renewpassword) {
            req.flash('error', 'New Password does not match Re-enter New Password.');
            return res.redirect('/profile');
        }

        const updateData = {
            name,
            username,
            phone,
            email,
            address
        };
        const user = await userService.getUserById(userId); // Ambil user 1x di awal

        // Password update
        if (newpassword) {
            const bcrypt = require('bcryptjs');
            updateData.password = await bcrypt.hash(newpassword, 10);
        }

        // Handle avatar upload
        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const filename = `avatar_${userId}_${Date.now()}${ext}`;
            const filepath = path.join('public/uploads', filename);

            fs.renameSync(req.file.path, filepath);
            updateData.profile_image = `/uploads/${filename}`;

            // Hapus file lama jika ada
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

        // Simpan ke database
        await userService.updateUserProfile(userId, updateData);

        // Update session lain jika nama/username berubah
        req.session.user.name = name;
        req.session.user.username = username;

        await logService.createLog({
            userId,
            level: 'INFO',
            message: `User ${username} updated their profile${newpassword ? ' and changed password' : ''}.`
        });

        req.flash('success', 'Profil berhasil diperbarui.');
        res.redirect('/profile');

    } catch (err) {
        console.error(err);
        req.flash('error', err.message || 'Gagal memperbarui profil');
        res.redirect('/profile');
    }
};