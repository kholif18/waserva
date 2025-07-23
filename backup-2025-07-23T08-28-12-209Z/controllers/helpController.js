exports.index = (req, res) => {
    res.render('helps/index', {
        title: 'Help',
        activePage: 'helps'
    });
};

exports.api = (req, res) => {
    res.render('helps/api', {
        title: 'API Help',
        activePage: 'helps'
    });
};
