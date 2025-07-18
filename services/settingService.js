const {
    Setting
} = require('../models');

async function getUserSettings(userId) {
    const keys = [
        'timeout', 'max_retry', 'retry_interval',
        'max_queue', 'rate_limit_limit', 'rate_limit_decay',
        'country_code'
    ];

    const rows = await Setting.findAll({
        where: {
            userId
        }
    });
    const result = {};
    for (const key of keys) {
        const found = rows.find(r => r.key === key);
        result[key] = found ? found.value : null;
    }
    return result;
}

module.exports = {
    getUserSettings
};
