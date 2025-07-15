// services/logService.js
const {
    Log
} = require('../models');

/**
 * Menyimpan log baru dan menghapus log lama jika lebih dari 2000 entri
 * @param {Object} data - Data log
 * @param {number|null} data.userId - ID pengguna (bisa null jika bukan user)
 * @param {string} data.level - Level log: info, warning, error, success
 * @param {string} data.message - Pesan log
 * @param {string} [data.ip] - IP address
 * @param {string} [data.userAgent] - User-Agent header
 */
async function createLog(data) {
    await Log.create(data);

    const count = await Log.count();
    if (count > 2000) {
        const oldest = await Log.findAll({
            order: [
                ['createdAt', 'ASC']
            ],
            limit: count - 2000
        });

        const idsToDelete = oldest.map(log => log.id);
        await Log.destroy({
            where: {
                id: idsToDelete
            }
        });
    }
}

/**
 * Fungsi praktis untuk log dengan data dari request
 * @param {Object} req - Express request object
 * @param {string} message - Pesan log
 * @param {string} [level='info'] - Level log
 */
async function logAction(req, message, level = 'info') {
    await createLog({
        userId: req.user ?.id || null,
        level,
        message,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown'
    });
}

module.exports = {
    createLog,
    logAction
};
