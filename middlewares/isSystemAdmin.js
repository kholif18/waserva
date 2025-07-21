module.exports = function isSystemAdmin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    if (req.session.user.role !== 'admin') {
        return res.status(403).render('errors/403', {
            layout: false,
            user: req.session.user,
            title: 'Access Denied',
            message: 'This feature is only available to administrators.'
        });
    }

    next();
};
