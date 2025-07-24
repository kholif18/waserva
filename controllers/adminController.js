const whatsappService = require('../services/whatsappService');
const {
    User,
    History
} = require('../models');
const {
    exec
} = require('child_process');
const {
    Op,
    fn,
    col
} = require('sequelize');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');
const semver = require('semver');

exports.dashboard = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const totalUsers = await User.count();

        // Jumlah permintaan API hari ini
        const apiRequestsToday = await History.count({
            where: {
                source: {
                    [Op.ne]: 'panel'
                },
                createdAt: {
                    [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });

        const totalMessages = await History.count();
        const successMessages = await History.count({
            where: {
                status: 'Success'
            }
        });
        const successRate = totalMessages ? ((successMessages / totalMessages) * 100).toFixed(1) : 0;

        // Ambil status sesi dari WhatsApp service
        const sessionStatuses = await whatsappService.getAllSessionStatus();
        const connectedUsers = sessionStatuses.filter(s => s.status === 'connected').length;

        // Ambil data jumlah pesan per hari (7 hari terakhir)
        const dailyMessages = await History.findAll({
            attributes: [
                [fn('DATE', col('createdAt')), 'date'],
                [fn('COUNT', col('id')), 'count']
            ],
            where: {
                createdAt: {
                    [Op.gte]: new Date(new Date() - 7 * 24 * 60 * 60 * 1000)
                }
            },
            group: [fn('DATE', col('createdAt'))],
            order: [
                [fn('DATE', col('createdAt')), 'ASC']
            ]
        });

        const statusCounts = await History.findAll({
            attributes: ['status', [fn('COUNT', col('status')), 'count']],
            group: ['status']
        });

        // Pie chart data
        const pieLabels = [];
        const pieData = [];
        statusCounts.forEach(item => {
            pieLabels.push(item.status);
            pieData.push(parseInt(item.dataValues.count));
        });

        // Line chart data
        const chartLabels = [];
        const chartData = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const formatted = date.toISOString().slice(0, 10);

            chartLabels.push(formatted);
            const found = dailyMessages.find(row => row.dataValues.date === formatted);
            chartData.push(found ? parseInt(found.dataValues.count) : 0);
        }

        // Render ke dashboard
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            activePage: 'dashboard',
            totalUsers,
            apiRequestsToday,
            successRate,
            connectedUsers,
            chartLabels,
            chartData,
            pieLabels,
            pieData,
        });
    } catch (err) {
        console.error('Gagal memuat dashboard:', err);
        req.flash('error', 'Gagal memuat dashboard.');
        res.redirect('/admin/dashboard');
    }
};

exports.viewSessionList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.per_page) || 10;
        const search = req.query.search || '';
        const highlightUserId = req.query.highlight ? parseInt(req.query.highlight) : null;

        // Ambil semua sesi dari service
        const sessionListRaw = await whatsappService.getAllSessionStatus();

        // Ambil ID semua user dari session
        const userIds = sessionListRaw.map(s => s.id).filter(id => !isNaN(id));

        const users = await User.findAll({
            where: {
                id: userIds
            }
        });

        // Gabungkan info user ke sesi
        let sessionList = sessionListRaw.map(session => {
            const user = users.find(u => u.id === session.id);
            return {
                ...session,
                name: user?.name || 'Unknown',
                email: user?.email || '',
                username: user?.username || '',
                highlight: highlightUserId === session.id
            };
        });

        // Filter pencarian (opsional)
        if (search.length > 0) {
            const searchLower = search.toLowerCase();
            sessionList = sessionList.filter(s =>
                s.name.toLowerCase().includes(searchLower) ||
                s.email.toLowerCase().includes(searchLower) ||
                s.username.toLowerCase().includes(searchLower)
            );
        }

        // Pagination
        const totalItems = sessionList.length;
        const totalPages = Math.ceil(totalItems / perPage);
        const offset = (page - 1) * perPage;
        const paginatedSessions = sessionList.slice(offset, offset + perPage);

        res.render('admin/sessions', {
            title: 'Monitoring Sesi WhatsApp',
            activePage: 'admin-sessions',
            sessionList: paginatedSessions,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                perPage
            },
            highlightUserId,
            search,
            req
        });

    } catch (err) {
        console.error('Gagal memuat sesi:', err);
        req.flash('error', 'Gagal memuat data sesi');
        res.redirect('/admin/dashboard');
    }
};

exports.resetUserSession = async (req, res) => {
    const userId = req.params.id;
    try {
        await whatsappService.resetUserSessionById(userId);
        req.flash('success', `Session user ID ${userId} berhasil di-reset`);
    } catch (err) {
        console.error('Gagal reset session:', err);
        req.flash('error', 'Gagal mereset session');
    }
    res.redirect('/admin/sessions');
};

exports.forceLogoutSession = async (req, res) => {
    const userId = req.params.id;

    try {
        const success = await whatsappService.logoutSession(userId);

        if (success) {
            req.flash('success', `User ID ${userId} berhasil di-force logout`);
        } else {
            req.flash('error', `Gagal force logout. Mungkin sesi tidak aktif.`);
        }
    } catch (err) {
        console.error('Gagal force logout session dari admin:', err);
        req.flash('error', 'Terjadi kesalahan saat force logout');
    }

    res.redirect('/admin/sessions');
};

exports.viewAdminSettings = (req, res) => {
    const currentUser = req.session.user;

    if (!currentUser || currentUser.role !== 'admin') {
        req.flash('error', 'Akses ditolak.');
        return res.redirect('admin/dashboard');
    }

    res.render('admin/settings', {
        title: 'Pengaturan Admin',
        activePage: 'admin-settings'
    });
};

exports.checkUpdate = async (req, res) => {
    try {
        const localVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'))).version;

        const repoRawUrl = 'https://raw.githubusercontent.com/kholif18/waserva/main/update-info.json';
        const response = await axios.get(repoRawUrl);
        const remoteInfo = response.data;
        const remoteVersion = remoteInfo.version;

        if (semver.gt(remoteVersion, localVersion)) {
            return res.json({
                updateAvailable: true,
                currentVersion: localVersion,
                latestVersion: remoteVersion,
                changelog: remoteInfo.changelog || '- Tidak ada changelog tersedia -'
            });
        } else {
            return res.json({
                updateAvailable: false,
                currentVersion: localVersion,
                latestVersion: remoteVersion
            });
        }
    } catch (err) {
        console.error('Gagal memeriksa update:', err);
        return res.status(500).json({
            error: 'Gagal memeriksa update dari GitHub'
        });
    }
};

exports.installUpdate = async (req, res) => {
    const zipUrl = 'https://github.com/kholif18/waserva/archive/refs/heads/main.zip';
    const tmpDir = path.join(__dirname, '../tmp');
    const zipPath = path.join(tmpDir, 'update.zip');
    const extractPath = path.join(tmpDir, 'update');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `../backup-${timestamp}`);

    try {
        // Buat folder sementara dan backup
        fs.mkdirSync(tmpDir, {
            recursive: true
        });
        fs.mkdirSync(backupPath, {
            recursive: true
        });

        // Step 1: Backup sistem penting (manual list)
        const itemsToBackup = ['controllers', 'models', 'routes', 'services', 'views', 'public', 'app.js'];
        for (const item of itemsToBackup) {
            const src = path.join(__dirname, '../', item);
            const dest = path.join(backupPath, item);
            if (fs.existsSync(src)) {
                fs.cpSync(src, dest, {
                    recursive: true
                });
            }
        }

        // Step 2: Download ZIP update dari GitHub
        const writer = fs.createWriteStream(zipPath);
        const response = await axios({
            url: zipUrl,
            method: 'GET',
            responseType: 'stream'
        });
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Step 3: Ekstrak ZIP
        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({
                path: extractPath
            }))
            .promise();

        const extractedFolder = fs.readdirSync(extractPath).find(f => f.startsWith('waserva-'));
        if (!extractedFolder) throw new Error('Folder hasil ekstrak tidak ditemukan.');

        const extractedPath = path.join(extractPath, extractedFolder);

        // Step 4: Copy semua file kecuali .env, uploads, sessions
        const execCopy = `rsync -a --exclude='.env' --exclude='public/uploads' --exclude='sessions' ${extractedPath}/ ./`;
        await runCommand(execCopy);

        // Step 4.5: Pastikan package.json terganti (karena rsync bisa melewatkan file ini)
        fs.copyFileSync(
            path.join(extractedPath, 'package.json'),
            path.join(__dirname, '../package.json')
        );

        // Step 5: Install dependency baru
        await runCommand('npm install');

        // Step 6: Jalankan migrasi DB
        await runCommand('npx sequelize db:migrate');
        
        // Step 6.5: Perbarui versi di memori
        const {
            refreshAppVersion
        } = require('../middlewares/appVersion');
        refreshAppVersion();

        console.log('Versi setelah refresh:', res.locals?.appVersion);

        // Hapus backup setelah semua langkah berhasil
        if (fs.existsSync(backupPath)) {
            fs.rmSync(backupPath, {
                recursive: true,
                force: true
            });
            console.log('🧹 Folder backup berhasil dihapus:', backupPath);
        }

        req.flash('success', 'Update berhasil diinstall. Silakan restart server.');
    } catch (err) {
        console.error('Gagal install update:', err);
        req.flash('error', 'Gagal menginstall update. Lihat log server.');
    } finally {
        // Hapus file update.zip dan folder hasil ekstrak
        try {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(extractPath)) fs.rmSync(extractPath, {
                recursive: true,
                force: true
            });
            console.log('🧹 File update.zip dan folder sementara berhasil dihapus.');
        } catch (cleanupErr) {
            console.warn('⚠️ Gagal membersihkan file sementara:', cleanupErr.message);
        }
        res.redirect('/admin/settings');
    }
};

function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, {
            cwd: path.resolve(__dirname, '../')
        }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[exec error] ${cmd}`, error);
                return reject(error);
            }
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
            resolve();
        });
    });
}