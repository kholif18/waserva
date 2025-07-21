module.exports = function isSystemAdmin(req, res, next) {
    if (!req.session?.user) {
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(401).json({
                error: 'Unauthorized'
            });
        }
        return res.redirect('/login');
    }

    if (req.session.user.role !== 'admin') {
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(403).json({
                error: 'Access Denied: Admin Only'
            });
        }

        return res.status(403).render('errors/403', {
            layout: false,
            user: req.session.user,
            title: 'Access Denied',
            message: 'This feature is only available to administrators.'
        });
    }

    console.log('[Middleware]', req.method, req.originalUrl, 'Accept:', req.headers.accept);
    next();
};

