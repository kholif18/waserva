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
            renewpassword
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

        if (newpassword) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(newpassword, 10);
            updateData.password = hashedPassword;
        }

        // Handle avatar upload
        if (req.file) {
            const ext = path.extname(req.file.originalname).toLowerCase();
            const filename = `avatar_${userId}_${Date.now()}${ext}`;
            const filepath = path.join('public/uploads', filename);

            fs.renameSync(req.file.path, filepath);
            updateData.profile_image = `/uploads/${filename}`;

            // Hapus file lama kalau ada
            const user = await userService.getUserById(userId);
            if (user.profile_image && fs.existsSync('public' + user.profile_image)) {
                fs.unlinkSync('public' + user.profile_image);
            }
        }

        // Handle avatar removal
        if (req.body.remove_avatar === '1') {
            updateData.profile_image = null;

            const user = await userService.getUserById(userId);
            if (user.profile_image && fs.existsSync('public' + user.profile_image)) {
                fs.unlinkSync('public' + user.profile_image);
            }
        }

        await userService.updateUserProfile(userId, updateData);
        req.flash('success', 'Profil berhasil diperbarui.');
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        req.flash('error', err.message || 'Gagal memperbarui profil');
        res.redirect('/profile');
    }
};
