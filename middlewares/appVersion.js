const fs = require('fs');
const path = require('path');

let currentVersion = readVersion();

function readVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')));
        return pkg.version;
    } catch (err) {
        console.error('Gagal membaca versi dari package.json:', err);
        return 'unknown';
    }
}

function setAppVersion(app) {
    app.locals.appVersion = currentVersion;
}

function refreshAppVersion(app) {
    currentVersion = readVersion();
    app.locals.appVersion = currentVersion;
    console.log('[refreshAppVersion] Versi aplikasi diperbarui:', currentVersion);
}

module.exports = {
    setAppVersion,
    refreshAppVersion,
};
