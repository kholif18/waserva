const {
    Log
} = require('../models');

module.exports = {
    /**
     * Simpan log ke database lokal
     * 
     * @param {Object} options
     * @param {number} options.userId - ID user yang terkait
     * @param {string} options.session - Nama sesi WhatsApp
     * @param {string} options.phone - Nomor tujuan
     * @param {string} options.message - Pesan log
     * @param {string} [options.type='text'] - Jenis log ('text', 'image', dll)
     * @param {string} [options.status='success'] - Status log ('success', 'failed', dll)
     */
    async addLog({
        userId,
        session,
        phone,
        message,
        type = 'text',
        status = 'success',
    }) {
        try {
            await Log.create({
                userId,
                sessionName: session,
                phone,
                message,
                type,
                status,
            });

            console.log(`✅ Log saved to database for ${phone}`);
        } catch (err) {
            console.error(`❌ Failed to save log:`, err.message);
        }
    }
};
