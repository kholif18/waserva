const {
    Setting,
    User
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
    const user = await User.findByPk(userId);
    const settings = {
        timeout: await getSetting(userId, 'timeout', 30),
        maxRetry: await getSetting(userId, 'max_retry', 3),
        retryInterval: await getSetting(userId, 'retry_interval', 10),
        maxQueue: await getSetting(userId, 'max_queue', 100),
        rateLimitLimit: await getSetting(userId, 'rate_limit_limit', 10),
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
    
    try {
        // Konversi ke Number
        const timeout = Number(data.timeout);
        const maxRetry = Number(data['max-retry']);
        const retryInterval = Number(data['retry-interval']);
        const maxQueue = Number(data['max-queue']);
        const rateLimitLimit = Number(data['rate_limit_limit']);
        const rateLimitDecay = Number(data['rate_limit_decay']);
        // Validasi nilai
        if (isNaN(timeout) || timeout < 5 || timeout > 120) throw new Error('Timeout must be between 5 and 120 seconds.');
        if (isNaN(maxRetry) || maxRetry < 0 || maxRetry > 10) throw new Error('Max retry must be between 0 and 10.');
        if (isNaN(retryInterval) || retryInterval < 5 || retryInterval > 60) throw new Error('Retry interval must be between 5 and 60.');
        if (isNaN(maxQueue) || maxQueue < 10 || maxQueue > 1000) throw new Error('Max queue must be between 10 and 1000.');
        if (isNaN(rateLimitLimit) || rateLimitLimit < 1 || rateLimitLimit > 100) throw new Error('Rate limit must be between 1 and 100.');
        if (isNaN(rateLimitDecay) || rateLimitDecay < 10 || rateLimitDecay > 3600) throw new Error('Rate limit decay must be between 10 and 3600.');

        // Simpan ke DB
        for (const [key, rawValue] of Object.entries(data)) {
            await Setting.upsert({
                userId,
                key: key.replace(/-/g, '_'),
                value: rawValue // atau Number(rawValue) jika kamu hanya menyimpan angka
            });
        }

        req.flash('success', 'Settings updated successfully.');
    }
    catch (error) {
        req.flash('error', error.message || 'Failed to update settings.');
    }

    res.redirect('/settings');
};

exports.reset = async (req, res) => {
    const userId = req.session.user.id;

    // Default setting bawaan
    const defaultSettings = {
        timeout: 30,
        max_retry: 3,
        retry_interval: 10,
        max_queue: 100,
        rate_limit_limit: 10,
        rate_limit_decay: 60,
        country_code: '62',
    };

    try {
        for (const [key, value] of Object.entries(defaultSettings)) {
            await Setting.upsert({
                userId,
                key,
                value
            });
        }

        req.flash('success', 'Settings have been reset to default.');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to reset settings.');
    }

    res.redirect('/settings');
};
