exports.index = (req, res) => {
    res.render('helps/index', {
        title: 'Help',
        user: req.session.user,
        activePage: 'helps'
    });
};

exports.api = (req, res) => {
    res.render('helps/api', {
        title: 'API Help',
        user: req.session.user,
        activePage: 'helps'
    });
};
