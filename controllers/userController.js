const userService = require('../services/userService');

exports.getMyProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await userService.getUserById(userId);

        res.render('pages/profile', {
            title: 'My Profile',
            user,
            error: null // supaya tidak undefined di EJS
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
            req.flash('error', 'Password baru tidak cocok dengan konfirmasi.');
            return res.redirect('/profile');
        }

        const updateData = {
            name,
            username,
            phone,
            email,
            address
        };
        if (newpassword) updateData.newpassword = newpassword;

        await userService.updateUserProfile(userId, updateData);
        req.flash('success', 'Profil berhasil diperbarui.');
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        req.flash('error', err.message || 'Gagal memperbarui profil');
        res.redirect('/profile');
    }
};
