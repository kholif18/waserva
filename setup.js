const fs = require('fs');
const {
    execSync
} = require('child_process');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

console.log('Menjalankan instalasi awal Waserva...');

if (!fs.existsSync(envPath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('.env berhasil dibuat dari .env.example');
} else {
    console.log('.env sudah ada, dilewati.');
}

try {
    execSync('npm install', {
        stdio: 'inherit'
    });
    execSync('npx sequelize db:migrate', {
        stdio: 'inherit'
    });
    execSync('npx sequelize db:seed:all', {
        stdio: 'inherit'
    });
    console.log('\n🎉 Instalasi selesai! Jalankan `npm start` untuk memulai aplikasi.');
} catch (err) {
    console.error('Terjadi kesalahan saat instalasi:', err);
}
