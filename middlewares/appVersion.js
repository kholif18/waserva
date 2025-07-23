const version = require('../package.json').version;

module.exports = (req, res, next) => {
    res.locals.appVersion = version;
    next();
};
