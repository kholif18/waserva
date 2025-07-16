const {
    Setting
} = require('../models');

// helper ambil value setting
async function getSetting(userId, key, defaultValue = '') {
    const record = await Setting.findOne({
        where: {
            userId,
            key
        }
    });
    return record ? record.value : defaultValue;
}

// tampilkan form setting
exports.index = async (req, res) => {
    const userId = req.session.user.id;
    const settings = {
        timeout: await getSetting(userId, 'timeout', 30),
        maxRetry: await getSetting(userId, 'max_retry', 3),
        retryInterval: await getSetting(userId, 'retry_interval', 10),
        maxQueue: await getSetting(userId, 'max_queue', 100),
        rateLimitLimit: await getSetting(userId, 'rate_limit_limit', 60),
        rateLimitDecay: await getSetting(userId, 'rate_limit_decay', 60),
        countryCode: await getSetting(userId, 'country_code', '62'),
    };

    res.render('pages/settings', {
        title: 'System Configuration',
        user: req.session.user,
        settings
    });
};

// simpan setting
exports.save = async (req, res) => {
    const userId = req.session.user.id;
    const data = req.body;

    for (const [key, value] of Object.entries(data)) {
        await Setting.upsert({
            userId,
            key: key.replace(/-/g, '_'),
            value: value
        });
    }

    req.flash('success', 'Settings updated successfully.');
    res.redirect('/settings');
};
