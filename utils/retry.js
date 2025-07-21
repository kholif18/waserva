const {
    History
} = require('../models');
const {
    Op
} = require('sequelize');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retrySend(fn, maxRetry, timeoutSec, retryIntervalSec) {
    let attempt = 0;
    while (attempt <= maxRetry) {
        try {
            await Promise.race([
                fn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutSec * 1000))
            ]);
            return {
                success: true
            };
        } catch (err) {
            if (attempt === maxRetry) {
                return {
                    success: false,
                    error: err.message
                };
            }
            attempt++;
            await delay(retryIntervalSec * 1000);
        }
    }
}

async function isRateLimited(userId, limit, decaySeconds) {
    if (!limit || !decaySeconds) return false;

    const since = new Date(Date.now() - Number(decaySeconds) * 1000);
    if (isNaN(since.getTime())) return false;

    const count = await History.count({
        where: {
            userId,
            createdAt: {
                [Op.gte]: since
            }
        }
    });

    return count >= limit;
}

module.exports = {
    retrySend,
    delay,
    isRateLimited
};
