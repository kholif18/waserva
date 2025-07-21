exports.requireRole = (role) => {
    return (req, res, next) => {
        const user = req.session.user;
        if (!user) {
            return res.redirect('/login'); // belum login
        }

        if (user.role !== role) {
            return res.status(403).render('errors/403', {
                message: 'Access Denied',
                layout: false,
            }); // atau redirect ke halaman sesuai
        }

        next(); // akses diizinkan
    };
};