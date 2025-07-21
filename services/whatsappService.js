const {
    Client,
    LocalAuth,
    MessageMedia
} = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const {
    Op
} = require('sequelize');
const logService = require('./logService');
const {
    logAdminOnly
} = require('./logService');
const settingService = require('./settingService');
const {
    History,
    User,
} = require('../models');
const log = require('../utils/logger');
const {
    normalizePhoneNumber
} = require('../utils/phone');
const {
    retrySend,
    isRateLimited
} = require('../utils/retry');
const {
    isQueueFull,
    increaseQueue,
    decreaseQueue
} = require('../utils/messageQueue');
const sessionManager = require('./sessionManager');
const {
    clients,
    sessions,
    qrCodes,
    getClient,
    getSessionKey,
    setClient,
    removeClient
} = require('./sessionManager');

let io = null;

function setSocketInstance(ioInstance) {
    io = ioInstance;
}

function emitToSocket(userId, event, data) {
    if (io) io.to(getSessionKey(userId)).emit(event, data);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForFileRelease(filePath, timeout = 5000) {
    const start = Date.now();
    while (fs.existsSync(filePath)) {
        if (Date.now() - start > timeout) return false;
        await wait(300);
    }
    return true;
}

const sessionBasePath = path.join(__dirname, '../sessions');

async function startSession(userId) {
    await log(userId, 'INFO', 'Memulai startSession()');

    const sessionKey = getSessionKey(userId);
    const sessionPath = path.join(sessionBasePath, `session-${sessionKey}`);
    const singletonLock = path.join(sessionPath, 'SingletonLock');

    // Cegah duplikat
    if (clients.has(sessionKey)) {
        await log(userId, 'INFO', 'Session sudah ada, tidak diinisialisasi ulang');
        return;
    }

    // Buat folder 'sessions/' jika belum ada (manual, bukan biarkan LocalAuth)
    if (!fs.existsSync(sessionBasePath)) {
        console.log('Folder sessions/ belum ada. Membuat secara manual...');
        fs.mkdirSync(sessionBasePath, {
            recursive: true
        });
    }

    // Tangani folder session kosong atau ter-lock
    try {
        if (fs.existsSync(sessionPath)) {
            if (fs.existsSync(singletonLock)) {
                await log(userId, 'WARN', 'SingletonLock terdeteksi. Gunakan Reset Session.');
                return;
            }

            const files = fs.readdirSync(sessionPath);
            if (files.length === 0 || !isValidSessionFolder(sessionPath)) {
                fs.rmSync(sessionPath, {
                    recursive: true,
                    force: true
                });
                await log(userId, 'WARN', 'Folder session kosong/tidak valid dihapus untuk pemulihan ulang.');
                await logAdminOnly(userId, 'WARN', `Admin: folder sesi tidak valid dihapus.`);
            }
        }

        const success = await waitForFileRelease(singletonLock, 5000);
        if (!success) {
            await log(userId, 'ERROR', 'Gagal memulai sesi: SingletonLock tidak hilang setelah 5 detik.');
            return;
        }
    } catch (err) {
        await log(userId, 'ERROR', `Gagal mengecek/menghapus session folder: ${err.message}`);
        return;
    }

    // Sekarang mulai WA Client
    console.log(`Membuat WhatsApp client untuk userId ${userId}`);
    await logAdminOnly(userId, 'INFO', `Admin: Membuat WhatsApp client untuk userId ${userId}`);
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: sessionKey,
            dataPath: sessionBasePath // hanya dipakai saat benar-benar dibutuhkan
        }),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
            protocolTimeout: 60000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=site-per-process',
                '--window-size=1920,1080'
            ]
        },
        takeoverOnConflict: true, // Tambahkan ini
        takeoverTimeoutMs: 5000, // Waktu tunggu sebelum reconnect
        restartOnAuthFail: true
    });

    sessions[sessionKey] = {
        client,
        status: 'starting'
    };
    emitToSocket(userId, 'session:update', {
        userId,
        status: 'starting'
    });

    // Listener selanjutnya tetap sama...
    client.on('qr', async qr => {
        const qrImage = await qrcode.toDataURL(qr);
        qrCodes.set(sessionKey, qrImage);
        sessions[sessionKey].status = 'qr';

        emitToSocket(userId, 'session:update', {
            userId,
            status: 'qr'
        });
        emitToSocket(userId, 'session:qr', {
            userId,
            qr: qrImage
        });

        setTimeout(() => qrCodes.delete(sessionKey), 60000);
    });

    client.on('ready', async () => {
        sessions[sessionKey].status = 'connected';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'connected'
        });
        await log(userId, 'INFO', 'WhatsApp session connected.');
        await logAdminOnly(userId, 'INFO', 'Sesi WhatsApp berhasil tersambung');

        // Backup folder session
        const sessionFolder = path.join(sessionBasePath, `session-${sessionKey}`);
        const backupFolder = path.join(sessionBasePath, `backup-${sessionKey}-${Date.now()}`);

        try {
            if (fs.existsSync(sessionFolder)) {
                fs.cpSync(sessionFolder, backupFolder, {
                    recursive: true
                });
                cleanupOldBackups(sessionKey);
                await log(userId, 'INFO', `Backup sesi berhasil disimpan: ${backupFolder}`);
                await logAdminOnly(userId, 'INFO', `Admin: backup sesi disimpan (${backupFolder})`);
            } else {
                await log(userId, 'WARN', `Folder sesi tidak ditemukan saat ready: ${sessionFolder}`);
            };
        } catch (err) {
            await log(userId, 'ERROR', `Gagal membuat backup sesi: ${err.message}`);
        }
    });

    client.on('auth_failure', async () => {
        sessions[sessionKey].status = 'auth_failure';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'auth_failure'
        });

        removeClient(sessionKey);
        qrCodes.delete(sessionKey);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
            await log(userId, 'INFO', 'Session folder dihapus karena auth failure');
        }

        await log(userId, 'ERROR', 'Authentication failed.');
        await logAdminOnly(userId, 'ERROR', 'Sesi gagal autentikasi (auth_failure)');
    });

    client.on('disconnected', async reason => {
        sessions[sessionKey].status = 'disconnected';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'disconnected',
            reason
        });

        const sessionFolder = path.join(sessionBasePath, `session-${sessionKey}`);
        const backupFolder = path.join(sessionBasePath, `backup-${sessionKey}-${Date.now()}`);
        if (fs.existsSync(sessionFolder)) {
            fs.cpSync(sessionFolder, backupFolder, {
                recursive: true
            });
            await log(userId, 'INFO', `Backup sesi disimpan sebelum disconnect: ${backupFolder}`);
            await logAdminOnly(userId, 'INFO', `Admin: backup sesi disimpan sebelum disconnect: (${backupFolder})`);
            cleanupOldBackups(sessionKey);
        }

        try {
            await client.destroy();
        } catch {}

        removeClient(sessionKey);
        qrCodes.delete(sessionKey);

        if (reason !== 'LOGOUT') setTimeout(() => startSession(userId), 5000);
        await log(userId, 'WARN', `Disconnected: ${reason}`);
        await logAdminOnly(userId, 'WARN', `Admin: sesi WhatsApp terputus: ${reason}`);
    });

    client.on('message', async msg => {
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) return;

        try {
            await axios.post(webhookUrl, {
                session: sessionKey,
                from: msg.from,
                to: msg.to || sessionKey,
                body: msg.body,
                type: msg.type,
                timestamp: msg.timestamp,
                isGroupMsg: msg.from.endsWith('@g.us'),
            });
        } catch (err) {
            await log(userId, 'ERROR', `Webhook failed: ${err.message}`);
        }
    });

    try {
        await client.initialize();
        setClient(sessionKey, client);
        await log(userId, 'INFO', 'client.initialize() selesai');
        await logAdminOnly(userId, 'INFO', `Admin: sesi WhatsApp berhasil dimulai.`);
    } catch (err) {
        console.error(`[${sessionKey}] Gagal initialize: ${err.message}`);
        await log(userId, 'ERROR', `Gagal memulai sesi WA: ${err.message}`);
    }
}

async function logoutSession(userId) {
    userId = getSessionKey(userId);
    const session = sessions[userId];
    if (!session || session.status !== 'connected') {
        await log(userId, 'WARN', 'Logout gagal: tidak ada sesi aktif.');
        return false;
    }

    try {
        await session.client.logout();
        await session.client.destroy();

        delete sessions[userId];
        removeClient(userId);
        qrCodes.delete(userId);

        const sessionPath = path.join(__dirname, '../sessions', `session-${userId}`);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
            await log(userId, 'INFO', 'Folder sesi berhasil dihapus');
        }

        await log(userId, 'INFO', 'Logout berhasil');
        await logAdminOnly(userId, 'INFO', 'Admin: sesi berhasil logout.');
        return true;
    } catch (err) {
        await log(userId, 'ERROR', `Logout gagal: ${err.message}`);
        return false;
    }
}

async function resetUserSessionById(userId) {
    const sessionKey = getSessionKey(userId);
    const sessionPath = path.join(sessionBasePath, `session-${sessionKey}`);
    const singletonLock = path.join(sessionPath, 'SingletonLock');

    await log(userId, 'INFO', `Memulai resetSession()`);

    // Destroy client jika masih aktif
    const client = getClient(userId);
    if (client) {
        await log(userId, 'INFO', 'Client aktif ditemukan. Mematikan...');
        try {
            await client.destroy();
            await logAdminOnly(userId, 'INFO', 'Admin: sesi berhasil direset.');
        } catch (err) {
            await log(userId, 'WARN', `Gagal destroy client: ${err.message}`);
            await logAdminOnly(userId, 'ERROR', 'Admin: gagal reset, SingletonLock tidak hilang.');

        }
        removeClient(userId);
    }

    // Tunggu jika ada file lock
    if (fs.existsSync(singletonLock)) {
        await log(userId, 'WARN', 'Menunggu file SingletonLock dihapus sebelum reset...');
        const start = Date.now();
        while (fs.existsSync(singletonLock)) {
            if (Date.now() - start > 5000) {
                await log(userId, 'ERROR', 'Reset gagal: SingletonLock tidak hilang setelah 5 detik.');
                throw new Error('SingletonLock still exists.');
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    // Hapus folder session
    if (fs.existsSync(sessionPath)) {
        try {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
            await log(userId, 'INFO', 'Session folder berhasil dihapus.');
        } catch (err) {
            await log(userId, 'ERROR', `Gagal menghapus folder session: ${err.message}`);
            throw err;
        }
    } else {
        await log(userId, 'INFO', 'Folder session tidak ditemukan saat reset.');
    }

    try {
        await startSession(userId); // gunakan service startSession()
        await log(userId, 'INFO', 'Sesi berhasil dimulai ulang setelah reset.');
    } catch (err) {
        await log(userId, 'ERROR', `Gagal memulai ulang sesi setelah reset: ${err.message}`);
        throw err;
    }
}

async function recoverAllSessionsOnStart() {
    console.log('Memulihkan sesi-sesi WhatsApp yang ada...');

    if (!fs.existsSync(sessionBasePath)) {
        console.log('Folder sessions tidak ditemukan. Lewati pemulihan.');
        return;
    }

    const sessionFolders = fs.readdirSync(sessionBasePath).filter((folder) => {
        const fullPath = path.join(sessionBasePath, folder);
        return fs.lstatSync(fullPath).isDirectory() && folder.startsWith('session-');
    });

    for (const folderName of sessionFolders) {
        const sessionName = folderName; // misalnya: session-2
        const sessionPath = path.join(sessionBasePath, sessionName);

        const lockFile = path.join(sessionPath, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
            console.warn(`Menghapus file SingletonLock untuk ${sessionName}`);
            try {
                fs.unlinkSync(lockFile);
            } catch (err) {
                console.error(`Gagal menghapus SingletonLock: ${err.message}`);
                continue; // Lewati sesi ini
            }
        }

        // Cek apakah sudah ada client aktif di sessionManager
        const client = getClient(sessionName);
        if (client) {
            console.log(`Sesi ${sessionName} sudah aktif. Lewati.`);
            continue;
        }

        // Ekstrak userId dari nama folder: "session-2" -> 2
        const userId = parseInt(sessionName.replace('session-', ''), 10);
        if (isNaN(userId)) {
            console.warn(`Tidak dapat ekstrak userId dari ${sessionName}. Lewati.`);
            continue;
        }

        // Panggil kembali startSession
        try {
            console.log(`Memulai ulang sesi: ${sessionName}`);
            await startSession(userId);
            await logAdminOnly(userId, 'INFO', 'Admin: sesi dipulihkan saat startup.');
        } catch (err) {
            console.error(`Gagal memulai ulang sesi ${sessionName}:`, err.message);
            await logAdminOnly(userId, 'ERROR', `Admin: gagal memulihkan sesi ${userId}.`);
        }
    }

    console.log('Pemulihan sesi selesai.');
}

function isClientReady(userId) {
    const sessionKey = getSessionKey(userId);
    const session = sessions[sessionKey];
    const client = clients.get(sessionKey);

    return !!(session && client && client.info);
}

function getStatus(userId) {
    return sessions[getSessionKey(userId)]?.status || 'not_initialized';
}

let isSafeToInit = false;

function enableInitActiveSessions() {
    isSafeToInit = true;
}

async function initActiveSessions() {
    if (!isSafeToInit) {
        console.warn('initActiveSessions() diblokir. Panggil enableInitActiveSessions() terlebih dahulu.');
        return;
    }

    const users = await User.findAll();
    console.log('[initActiveSessions] User yang ditemukan di DB:', users.map(u => u.id));
    for (const user of users) {
        try {
            await startSession(user.id);
            await log(user.id, 'INFO', 'Session dimulai otomatis saat inisialisasi server');
        } catch (err) {
            await log(user.id, 'ERROR', `Gagal memulai session saat init: ${err.message}`);
        }
    }
}

async function getAllSessionStatus() {
    const users = await User.findAll({
        attributes: ['id', 'name', 'username', 'email', 'role']
    });

    return users.map(user => {
        const status = getStatus(user.id);
        return {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            status
        };
    });
}

function isValidSessionFolder(sessionPath) {
    if (!fs.existsSync(sessionPath)) return false;
    const files = fs.readdirSync(sessionPath);
    // File penting biasanya ada saat session valid
    return files.includes('Default') || files.includes('PreKeys');
}

async function restoreFromBackupIfMissing() {
    const folders = fs.readdirSync(sessionBasePath);

    const backups = folders.filter(name => name.startsWith('backup-'));
    const sessions = folders.filter(name => name.startsWith('session-'));

    for (const backup of backups) {
        const sessionKey = backup.split('-')[1];
        const sessionFolder = `session-${sessionKey}`;
        const sessionPath = path.join(sessionBasePath, sessionFolder);

        const needsRestore = !fs.existsSync(sessionPath) ||
            fs.readdirSync(sessionPath).length === 0 ||
            !isValidSessionFolder(sessionPath);

        if (needsRestore) {
            const fromPath = path.join(sessionBasePath, backup);
            const toPath = sessionPath;

            try {
                fs.cpSync(fromPath, toPath, {
                    recursive: true
                });
                console.log(`Sesi "${sessionKey}" dipulihkan dari backup.`);
            } catch (err) {
                console.error(`Gagal restore backup untuk ${sessionKey}:`, err.message);
            }
        }
    }
}

async function cleanupOldBackups(sessionKey, userId, maxBackup = 3) {
    const allBackups = fs.readdirSync(sessionBasePath)
        .filter(name => name.startsWith(`backup-${sessionKey}-`))
        .map(name => ({
            name,
            path: path.join(sessionBasePath, name),
            createdAt: fs.statSync(path.join(sessionBasePath, name)).mtimeMs
        }))
        .sort((a, b) => b.createdAt - a.createdAt); // dari terbaru ke terlama

    const oldBackups = allBackups.slice(maxBackup);

    for (const backup of oldBackups) {
        try {
            fs.rmSync(backup.path, {
                recursive: true,
                force: true
            });
            console.log(`Backup lama dihapus: ${backup.name}`);
            await logAdminOnly(userId, 'INFO', `Backup lama dihapus: ${backup.name}`);
        } catch (err) {
            console.error(`Gagal hapus backup ${backup.name}:`, err.message);
            await logAdminOnly(userId, 'ERROR', `Gagal hapus backup ${backup.name}: ${err.message}`);
        }
    }
}


async function boot() {
    const {
        validateSessionFolders
    } = require('../middlewares/sessionBootValidator');
    validateSessionFolders();

    await restoreFromBackupIfMissing();

    await recoverAllSessionsOnStart();
    enableInitActiveSessions();
    await initActiveSessions();
}

// ========== Messaging ==========

async function getSettingsAndClient(userId) {
    try {
        const client = getClient(userId);
        if (!client) return {
            error: 'Session tidak ditemukan'
        };

        const settings = await settingService.getUserSettings(userId);
        return {
            client,
            ...settings
        };
    } catch (err) {
        await log(userId, 'ERROR', `Gagal mengambil setting user: ${err.message}`);
        return {
            error: 'Gagal memuat setting pengguna'
        };
    }
}

async function sendText(userId, rawPhone, message, source = 'unknown') {
    const settingsResult = await getSettingsAndClient(userId);
    if (settingsResult.error) {
        return {
            success: false,
            error: settingsResult.error
        };
    }

    const {
        client,
        country_code,
        timeout,
        max_retry,
        retry_interval,
        rate_limit_limit,
        rate_limit_decay,
        max_queue
    } = settingsResult;

    const phone = normalizePhoneNumber(rawPhone, country_code);
    if (!phone) {
        return {
            success: false,
            error: 'Nomor tidak valid'
        };
    }

    const limited = await isRateLimited(userId, rate_limit_limit, rate_limit_decay);
    if (limited) {
        await logService.createLog({
            userId,
            level: 'WARNING',
            message: `Rate limit exceeded: Max ${rate_limit_limit} messages per ${rate_limit_decay}s.`
        });

        return {
            success: false,
            error: `Rate limit exceeded. Max ${rate_limit_limit} messages per ${rate_limit_decay} seconds.`
        };
    }

    if (process.env.NODE_ENV !== 'production') {
        await logService.createLog({
            userId,
            level: 'DEBUG',
            message: `[DEV] Kirim pesan: ${JSON.stringify({
                rawPhone,
                normalized: phone,
                timeout,
                max_retry,
                retry_interval,
                rate_limit_limit,
                rate_limit_decay,
                max_queue
            })}`
        });
    }

    if (isQueueFull(userId, max_queue)) {
        return {
            success: false,
            error: `Antrean penuh. Maksimum ${max_queue} pesan dapat diproses sekaligus.`
        };
    }

    increaseQueue(userId);
    try {
        const result = await retrySend(
            () => client.sendMessage(`${phone}@c.us`, message),
            max_retry,
            timeout,
            retry_interval
        );

        await History.create({
            userId,
            phone,
            message,
            type: 'text',
            status: result.success ? 'success' : 'failed',
            source
        });

        return result.success ?
            {
                success: true
            } :
            {
                success: false,
                error: 'Gagal mengirim pesan',
                detail: result.error
            };

    } finally {
        decreaseQueue(userId);
    }
}

async function sendMediaFromUrl(userId, rawPhone, fileUrl, caption, source = 'unknown') {
    const settingsResult = await getSettingsAndClient(userId);
    if (settingsResult.error) {
        return {
            success: false,
            error: settingsResult.error
        };
    }

    const {
        client,
        country_code,
        timeout,
        max_retry,
        retry_interval,
        rate_limit_limit,
        rate_limit_decay,
        max_queue
    } = settingsResult;

    const phone = normalizePhoneNumber(rawPhone, country_code);
    if (!phone) {
        return {
            success: false,
            error: 'Nomor tidak valid'
        };
    }

    const limited = await isRateLimited(userId, rate_limit_limit, rate_limit_decay);
    if (limited) {
        await logService.createLog({
            userId,
            level: 'WARNING',
            message: `Rate limit exceeded: Max ${rate_limit_limit} messages per ${rate_limit_decay}s.`
        });

        return {
            success: false,
            error: `Rate limit exceeded. Max ${rate_limit_limit} messages per ${rate_limit_decay} seconds.`
        };
    }

    if (process.env.NODE_ENV !== 'production') {
        await logService.createLog({
            userId,
            level: 'DEBUG',
            message: `[DEV] Kirim media: ${JSON.stringify({
                rawPhone,
                normalized: phone,
                fileUrl,
                caption,
                timeout,
                max_retry,
                retry_interval,
                rate_limit_limit,
                rate_limit_decay,
                max_queue
            })}`
        });
    }

    if (isQueueFull(userId, max_queue)) {
        return {
            success: false,
            error: `Antrean penuh. Maksimum ${max_queue} pesan dapat diproses sekaligus.`
        };
    }

    increaseQueue(userId);
    try {
        const result = await retrySend(
            async () => {
                    const media = await MessageMedia.fromUrl(fileUrl);
                    await client.sendMessage(`${phone}@c.us`, media, {
                        caption
                    });
                },
                max_retry,
                timeout,
                retry_interval
        );

        await History.create({
            userId,
            phone,
            message: caption || '[media]',
            type: 'media',
            status: result.success ? 'success' : 'failed',
            source
        });

        return result.success ?
            {
                success: true
            } :
            {
                success: false,
                error: 'Gagal mengirim media',
                detail: result.error
            };

    } finally {
        decreaseQueue(userId);
    }
}
async function sendMediaFromUpload(userId, rawPhone, file, caption, source = 'unknown') {
    const settingsResult = await getSettingsAndClient(userId);
    if (settingsResult.error) {
        return {
            success: false,
            error: settingsResult.error
        };
    }

    const {
        client,
        country_code,
        timeout,
        max_retry,
        retry_interval,
        rate_limit_limit,
        rate_limit_decay,
        max_queue
    } = settingsResult;

    const phone = normalizePhoneNumber(rawPhone, country_code);
    if (!phone) {
        return {
            success: false,
            error: 'Nomor tidak valid'
        };
    }

    const limited = await isRateLimited(userId, rate_limit_limit, rate_limit_decay);
    if (limited) {
        await logService.createLog({
            userId,
            level: 'WARNING',
            message: `Rate limit exceeded: Max ${rate_limit_limit} messages per ${rate_limit_decay}s.`
        });

        return {
            success: false,
            error: `Rate limit exceeded. Max ${rate_limit_limit} messages per ${rate_limit_decay} seconds.`
        };
    }

    if (process.env.NODE_ENV !== 'production') {
        await logService.createLog({
            userId,
            level: 'DEBUG',
            message: `[DEV] Kirim file upload: ${JSON.stringify({
                rawPhone,
                normalized: phone,
                timeout,
                max_retry,
                retry_interval,
                rate_limit_limit,
                rate_limit_decay,
                max_queue,
                filename: file.originalname
            })}`
        });
    }

    if (isQueueFull(userId, max_queue)) {
        return {
            success: false,
            error: `Antrean penuh. Maksimum ${max_queue} pesan dapat diproses sekaligus.`
        };
    }

    increaseQueue(userId);
    try {
        const result = await retrySend(
            async () => {
                    const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);
                    await client.sendMessage(`${phone}@c.us`, media, {
                        caption
                    });
                },
                max_retry,
                timeout,
                retry_interval
        );

        await History.create({
            userId,
            phone,
            message: caption || `[file: ${file.originalname}]`,
            type: 'file',
            status: result.success ? 'success' : 'failed',
            source
        });

        return result.success ?
            {
                success: true
            } :
            {
                success: false,
                error: 'Gagal mengirim file',
                detail: result.error
            };

    } finally {
        decreaseQueue(userId);
    }
}

async function sendToGroup(userId, groupName, message, source = 'unknown') {
    const settingsResult = await getSettingsAndClient(userId);
    if (settingsResult.error) {
        return {
            success: false,
            error: settingsResult.error
        };
    }

    const {
        client,
        timeout,
        max_retry,
        retry_interval,
        rate_limit_limit,
        rate_limit_decay,
        max_queue
    } = settingsResult;

    const limited = await isRateLimited(userId, rate_limit_limit, rate_limit_decay);
    if (limited) {
        await logService.createLog({
            userId,
            level: 'WARNING',
            message: `Rate limit exceeded: Max ${rate_limit_limit} messages per ${rate_limit_decay}s.`
        });

        return {
            success: false,
            error: `Rate limit exceeded. Max ${rate_limit_limit} messages per ${rate_limit_decay} seconds.`
        };
    }

    if (process.env.NODE_ENV !== 'production') {
        await logService.createLog({
            userId,
            level: 'DEBUG',
            message: `[DEV] Kirim grup: ${JSON.stringify({
                groupName,
                timeout,
                max_retry,
                retry_interval,
                rate_limit_limit,
                rate_limit_decay,
                max_queue
            })}`
        });
    }

    if (isQueueFull(userId, max_queue)) {
        return {
            success: false,
            error: `Antrean penuh. Maksimum ${max_queue} pesan dapat diproses sekaligus.`
        };
    }

    increaseQueue(userId);
    try {
        const result = await retrySend(
            async () => {
                    const chats = await client.getChats();
                    const group = chats.find(chat => chat.isGroup && chat.name === groupName);
                    if (!group) throw new Error(`Grup "${groupName}" tidak ditemukan`);
                    await group.sendMessage(message);
                },
                max_retry,
                timeout,
                retry_interval
        );

        await History.create({
            userId,
            phone: groupName,
            message,
            type: 'group',
            status: result.success ? 'success' : 'failed',
            source
        });

        return result.success ?
            {
                success: true
            } :
            {
                success: false,
                error: 'Gagal kirim ke grup',
                detail: result.error
            };

    } finally {
        decreaseQueue(userId);
    }
}

async function sendBulk(userId, phones, message, delayMs = 1000, source = 'unknown') {
    const settingsResult = await getSettingsAndClient(userId);
    if (settingsResult.error) {
        return {
            success: false,
            error: settingsResult.error
        };
    }

    const {
        client,
        country_code,
        timeout,
        max_retry,
        retry_interval,
        rate_limit_limit,
        rate_limit_decay,
        max_queue
    } = settingsResult;

    const limited = await isRateLimited(userId, rate_limit_limit, rate_limit_decay);
    if (limited) {
        await logService.createLog({
            userId,
            level: 'WARNING',
            message: `Rate limit exceeded: Max ${rate_limit_limit} messages per ${rate_limit_decay}s.`
        });

        return {
            success: false,
            error: `Rate limit exceeded. Max ${rate_limit_limit} messages per ${rate_limit_decay} seconds.`
        };
    }

    if (process.env.NODE_ENV !== 'production') {
        await logService.createLog({
            userId,
            level: 'DEBUG',
            message: `[DEV] Kirim bulk: ${JSON.stringify({
                total: phones.length,
                timeout,
                max_retry,
                retry_interval,
                rate_limit_limit,
                rate_limit_decay,
                max_queue
            })}`
        });
    }

    if (isQueueFull(userId, max_queue)) {
        return {
            success: false,
            error: `Antrean penuh. Maksimum ${max_queue} pesan dapat diproses sekaligus.`
        };
    }

    increaseQueue(userId);
    const results = [];
    const normalizedList = [];
    let hasFailure = false;

    try {
        for (const rawPhone of phones) {
            const phone = normalizePhoneNumber(rawPhone, country_code);
            if (!phone) {
                results.push({
                    phone: rawPhone,
                    success: false,
                    error: 'Nomor tidak valid'
                });
                hasFailure = true;
                continue;
            }

            normalizedList.push(phone);
            const result = await retrySend(
                () => client.sendMessage(`${phone}@c.us`, message),
                max_retry,
                timeout,
                retry_interval
            );

            results.push({
                phone,
                success: result.success,
                error: result.error
            });
            if (!result.success) hasFailure = true;

            await wait(delayMs);
        }

        await History.create({
            userId,
            phone: normalizedList.join(', '),
            message,
            type: 'bulk',
            status: hasFailure ? 'failed' : 'success',
            source
        });

        return {
            results
        };

    } finally {
        decreaseQueue(userId);
    }
}

module.exports = {
    setSocketInstance,
    startSession,
    logoutSession,
    resetUserSessionById,
    getStatus,
    boot,
    recoverAllSessionsOnStart,
    getClient,
    isClientReady,
    enableInitActiveSessions,
    initActiveSessions,
    getAllSessionStatus,
    sendText,
    sendMediaFromUrl,
    sendMediaFromUpload,
    sendToGroup,
    sendBulk
};
