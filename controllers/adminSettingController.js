const {
    AdminSetting
} = require('../models');

exports.viewSettings = async (req, res) => {
    try {
        const settings = await AdminSetting.findAll();
        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key] = s.value);

        res.render('admin/settings', {
            title: 'Admin Settings',
            activePage: 'admin-settings',
            settings: settingsMap
        });
    } catch (err) {
        console.error('Gagal memuat settings:', err);
        res.status(500).send('Gagal memuat halaman pengaturan');
    }
};

exports.saveSettings = async (req, res) => {
    try {
        const keys = [
            'appName', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_secure', 'from_email'
        ];

        // optional field
        if (req.body.smtp_pass) keys.push('smtp_pass');

        for (const key of keys) {
            const value = req.body[key];
            await AdminSetting.upsert({
                key,
                value
            });
        }

        req.flash('success', 'Pengaturan berhasil disimpan.');
        res.redirect('/admin/settings');
    } catch (err) {
        console.error('Gagal menyimpan settings:', err);
        req.flash('error', 'Gagal menyimpan pengaturan.');
        res.redirect('/admin/settings');
    }
};