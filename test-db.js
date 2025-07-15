const db = require('./models');

db.sequelize.authenticate()
    .then(() => console.log('✅ Koneksi berhasil'))
    .catch(err => console.error('❌ Gagal koneksi:', err));
