const {
    Log,
    User
} = require('../models');

// Fungsi mencatat log
async function createLog({
    userId,
    level = 'INFO',
    message
}) {
    try {
        if (!userId || !message) {
            console.warn('Skipping log: userId or message missing.');
            return;
        }

        await Log.create({
            userId,
            level,
            message
        });

        await cleanupLogs(userId);
    } catch (err) {
        console.error('[LOGGER] Gagal mencatat log:', err.message);
    }
}

// Auto-delete log jika melebihi 2000 entri
async function cleanupLogs(userId) {
    const total = await Log.count({
        where: {
            userId
        }
    });

    if (total > 2000) {
        const excess = total - 2000;
        const oldest = await Log.findAll({
            where: {
                userId
            },
            order: [
                ['createdAt', 'ASC']
            ],
            limit: excess
        });

        const ids = oldest.map(log => log.id);
        await Log.destroy({
            where: {
                id: ids
            }
        });
    }
}

// Log hanya untuk user dengan role admin
async function logAdminOnly(userId, level, message) {
    try {
        const user = await User.findByPk(userId);
        if (user && user.role === 'admin') {
            await createLog({
                userId,
                level,
                message
            });
        }
    } catch (err) {
        console.error('[logAdminOnly] Gagal cek user admin:', err.message);
    }
}

// ✅ EXPORT BENAR
module.exports = {
    createLog,
    logAdminOnly
};
