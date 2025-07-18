const {
    Log
} = require('../models');

exports.createLog = async ({
    userId,
    level = 'INFO',
    message
}) => {
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

        // Opsional: cleanup jika lebih dari 2000 log
        await cleanupLogs(userId);
    } catch (err) {
        console.error('❌ Error creating log:', err.message, err.errors || err);
    }
};

// Optional: Auto-delete log jika lebih dari 2000
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
