const fs = require('fs');
const path = require('path');

function readVersionFromPackage() {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')));
        return pkg.version;
    } catch (err) {
        console.error('Gagal membaca versi package.json:', err);
        return 'unknown';
    }
}

// Middleware init di awal request
function appVersion(req, res, next) {
    res.app.locals.appVersion = readVersionFromPackage();
    next();
}

// Untuk dipanggil ulang saat update
function refreshAppVersion(app) {
    const version = readVersionFromPackage();
    app.locals.appVersion = version;
    console.log('✅ Versi aplikasi di-refresh:', version);
}

module.exports = {
    appVersion,
    refreshAppVersion
};
