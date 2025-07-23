const {
    AdminSetting
} = require('../models');
const path = require('path');
const fs = require('fs');

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
            'appName', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_secure', 'from_email', 'smtp_name'
        ];

        if (req.body.smtp_pass) keys.push('smtp_pass');

        if (req.file) {
            // Ambil logo lama dari DB
            const currentLogo = await AdminSetting.findOne({
                where: {
                    key: 'logo'
                }
            });

            // Hapus file lama jika bukan default
            if (
                currentLogo &&
                currentLogo.value &&
                currentLogo.value !== '/assets/img/logo.png'
            ) {
                const oldPath = path.join('public', currentLogo.value);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            // Simpan path logo baru
            const logoPath = `/uploads/${req.file.filename}`;
            keys.push('logo');
            req.body.logo = logoPath;
        }

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


exports.resetToDefault = async (req, res) => {
    try {
        // Cari logo lama
        const currentLogo = await AdminSetting.findOne({
            where: {
                key: 'logo'
            }
        });

        // Hapus file jika bukan default
        if (
            currentLogo &&
            currentLogo.value &&
            currentLogo.value !== '/assets/img/logo.png'
        ) {
            const logoPath = path.join('public', currentLogo.value);
            if (fs.existsSync(logoPath)) {
                fs.unlinkSync(logoPath);
            }
        }

        // Hapus semua setting
        await AdminSetting.destroy({
            where: {}
        });

        // Isi default
        const defaultSettings = [{
                key: 'logo',
                value: '/assets/img/logo.png'
            },
            {
                key: 'appName',
                value: 'aserva'
            },
            {
                key: 'smtp_host',
                value: ''
            },
            {
                key: 'smtp_port',
                value: ''
            },
            {
                key: 'smtp_user',
                value: ''
            },
            {
                key: 'smtp_pass',
                value: ''
            },
            {
                key: 'smtp_secure',
                value: 'true'
            },
            {
                key: 'from_email',
                value: ''
            },
        ];

        await AdminSetting.bulkCreate(defaultSettings);

        req.flash('success', 'Pengaturan berhasil dikembalikan ke default.');
        res.redirect('/admin/settings');
    } catch (err) {
        console.error('Gagal reset pengaturan:', err);
        req.flash('error', 'Gagal reset pengaturan.');
        res.redirect('/admin/settings');
    }
};

exports.updateRegistrationStatus = async (req, res) => {
    try {
        const {
            value
        } = req.body;
        await AdminSetting.update({
            value
        }, {
            where: {
                key: 'allow_registration'
            }
        });
        res.status(200).json({
            success: true
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Gagal memperbarui pengaturan'
        });
    }
};
