const logService = require('../services/logService');

/**
 * Simpan log ke database.
 * @param {number|string} userId - ID user.
 * @param {'INFO' | 'WARN' | 'ERROR'} level - Level log.
 * @param {string} message - Pesan log.
 */
async function log(userId, level, message) {
    if (!userId || !message) return;

    try {
        await logService.createLog({
            userId: parseInt(userId),
            level: level.toUpperCase(),
            message
        });
    } catch (err) {
        console.error(`[LOGGER] Gagal mencatat log: ${err.message}`);
    }
}

module.exports = log;
