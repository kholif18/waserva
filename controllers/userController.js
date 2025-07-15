const userService = require('../services/userService');

exports.getMyProfile = async (req, res) => {
    try {
        const userId = req.session.user.id; // pastikan user login
        const user = await userService.getUserById(userId);
        res.render('pages/profile', {
            title: 'My Profile',
            user
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading profile');
    }
};

exports.updateMyProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const data = req.body;
        await userService.updateUserProfile(userId, data);
        res.redirect('/myprofile');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating profile');
    }
};
