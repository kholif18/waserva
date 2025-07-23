// // middlewares/requireLogin.js
module.exports = function requireLogin(req, res, next) {
    if (req.session?.user) {
        return next(); // ← ini penting agar user bisa lanjut
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
            error: 'Unauthorized'
        });
    }

    return res.redirect('/login');
};
