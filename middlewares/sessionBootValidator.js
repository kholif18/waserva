const fs = require('fs');
const path = require('path');

const sessionBasePath = path.join(__dirname, '../sessions');

function isFolderEmpty(folderPath) {
    return fs.readdirSync(folderPath).length === 0;
}

function validateSessionFolders() {
    console.log('Menjalankan validasi folder session WhatsApp...');

    if (!fs.existsSync(sessionBasePath)) {
        console.warn('Folder sessions tidak ditemukan. Membuat...');
        fs.mkdirSync(sessionBasePath, {
            recursive: true
        });
        return;
    }

    const folders = fs.readdirSync(sessionBasePath).filter(name => {
        const full = path.join(sessionBasePath, name);
        return fs.lstatSync(full).isDirectory();
    });

    for (const folder of folders) {
        const sessionPath = path.join(sessionBasePath, folder);
        const lockFile = path.join(sessionPath, 'SingletonLock');

        // Kosong? Hapus
        if (isFolderEmpty(sessionPath)) {
            console.warn(`Folder ${folder} kosong. Menghapus...`);
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
            continue;
        }

        // SingletonLock? Hapus
        if (fs.existsSync(lockFile)) {
            console.warn(`SingletonLock ditemukan di ${folder}. Menghapus...`);
            try {
                fs.unlinkSync(lockFile);
            } catch (err) {
                console.error(`Gagal hapus SingletonLock di ${folder}:`, err.message);
            }
        }

        // Validasi isi
        const files = fs.readdirSync(sessionPath);
        if (!files.includes('Default')) {
            console.warn(`Folder ${folder} mencurigakan (tidak ada folder Default). Pertimbangkan untuk reset manual.`);
        }
    }
}

module.exports = {
    validateSessionFolders
};