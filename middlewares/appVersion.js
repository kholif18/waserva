const fs = require('fs');
const path = require('path');

let currentVersion = readVersion();

function readVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')));
        return pkg.version;
    } catch (err) {
        console.error('Gagal membaca package.json:', err);
        return 'unknown';
    }
}

function appVersion(req, res, next) {
    res.locals.appVersion = currentVersion;
    next();
}

function refreshAppVersion() {
    currentVersion = readVersion();
    console.log('[appVersion] Versi diperbarui:', currentVersion);
}

module.exports = {
    appVersion,
    refreshAppVersion
};
