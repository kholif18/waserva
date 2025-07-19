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
    retrySend
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
        console.log('📁 Folder sessions/ belum ada. Membuat secara manual...');
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
            if (files.length === 0) {
                fs.rmSync(sessionPath, {
                    recursive: true,
                    force: true
                });
                await log(userId, 'INFO', 'Session folder kosong dihapus.');
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
    console.log(`📲 Membuat WhatsApp client untuk userId ${userId}`);
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: sessionKey,
            dataPath: sessionBasePath // hanya dipakai saat benar-benar dibutuhkan
        }),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=site-per-process',
                '--window-size=1920,1080'
            ]
        }
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
    });

    client.on('disconnected', async reason => {
        sessions[sessionKey].status = 'disconnected';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'disconnected',
            reason
        });

        try {
            await client.destroy();
        } catch {}

        removeClient(sessionKey);
        qrCodes.delete(sessionKey);

        if (reason !== 'LOGOUT') setTimeout(() => startSession(userId), 5000);
        await log(userId, 'WARN', `Disconnected: ${reason}`);
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
    } catch (err) {
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
        return true;
    } catch (err) {
        await log(userId, 'ERROR', `Logout gagal: ${err.message}`);
        return false;
    }
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
        console.warn('⚠️ initActiveSessions() diblokir. Panggil enableInitActiveSessions() terlebih dahulu.');
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

// ========== Messaging ==========

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    getStatus,
    getClient,
    initActiveSessions,
    sendText,
    sendMediaFromUrl,
    sendMediaFromUpload,
    sendToGroup,
    sendBulk
};
