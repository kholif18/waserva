const fs = require('fs');
const path = require('path');

function readVersionFromPackage() {
    try {
        const pkgPath = path.join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.version;
    } catch (err) {
        console.error('Gagal membaca package.json:', err);
        return 'unknown';
    }
}

function appVersion(req, res, next) {
    res.app.locals.appVersion = readVersionFromPackage();
    next();
}

function refreshAppVersion(app) {
    app.locals.appVersion = readVersionFromPackage();
}

module.exports = {
    appVersion,
    refreshAppVersion
};
