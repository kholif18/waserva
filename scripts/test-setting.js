const {
    sequelize,
    Setting
} = require('../models');
const {
    getUserSettings
} = require('../services/settingService');

(async () => {
    try {
        await sequelize.authenticate(); // koneksi ke DB
        const settings = await getUserSettings(1); // ganti dengan userId yg ada
        console.log('🎯 SETTINGS:', settings);
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    } finally {
        await sequelize.close();
    }
})();
