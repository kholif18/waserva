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
    getClient,
    setClient,
    removeClient
} = require('../utils/whatsappClient');
const settingService = require('./settingService');
const {
    History,
    User
} = require('../models');
const {
    normalizePhoneNumber
} = require('../utils/phone');

let io = null;
const clients = global.clients = global.clients || new Map();
const sessions = global.sessions = global.sessions || {};
const qrCodes = global.qrCodes = global.qrCodes || new Map();

function setSocketInstance(ioInstance) {
    io = ioInstance;
}

function getSessionKey(userId) {
    return userId.toString();
}

function emitToSocket(userId, event, data) {
    if (io) io.to(getSessionKey(userId)).emit(event, data);
}

async function startSession(userId) {
    userId = getSessionKey(userId);
    if (clients.has(userId)) return;

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: userId,
            dataPath: path.join(__dirname, '../sessions')
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

    sessions[userId] = {
        client,
        status: 'starting'
    };
    emitToSocket(userId, 'session:update', {
        userId,
        status: 'starting'
    });

    client.on('qr', async qr => {
        const qrImage = await qrcode.toDataURL(qr);
        qrCodes.set(userId, qrImage);
        sessions[userId].status = 'qr';
        emitToSocket(userId, 'session:qr', {
            userId,
            qr: qrImage
        });
        setTimeout(() => qrCodes.delete(userId), 60000);
    });

    client.on('ready', async () => {
        sessions[userId].status = 'connected';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'connected'
        });
        await logService.createLog({
            userId: parseInt(userId),
            level: 'INFO',
            message: 'WhatsApp session connected.'
        });
    });

    client.on('auth_failure', async () => {
        sessions[userId].status = 'auth_failure';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'auth_failure'
        });
        removeClient(userId);
        qrCodes.delete(userId);
        await logService.createLog({
            userId: parseInt(userId),
            level: 'ERROR',
            message: 'Authentication failed.'
        });
    });

    client.on('disconnected', async reason => {
        sessions[userId].status = 'disconnected';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'disconnected',
            reason
        });
        try {
            await client.destroy();
        } catch {}
        removeClient(userId);
        qrCodes.delete(userId);

        if (reason !== 'LOGOUT') setTimeout(() => startSession(userId), 5000);

        await logService.createLog({
            userId: parseInt(userId),
            level: 'WARN',
            message: `Disconnected: ${reason}`
        });
    });

    client.on('message', async msg => {
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) return;
        try {
            await axios.post(webhookUrl, {
                session: userId,
                from: msg.from,
                to: msg.to || userId,
                body: msg.body,
                type: msg.type,
                timestamp: msg.timestamp,
                isGroupMsg: msg.from.endsWith('@g.us'),
            });
        } catch (err) {
            console.error('❌ Webhook failed:', err.message);
        }
    });

    await client.initialize();
    setClient(userId, client);
}

async function logoutSession(userId) {
    userId = getSessionKey(userId);
    const session = sessions[userId];
    if (!session || session.status !== 'connected') return false;

    try {
        await session.client.logout();
        await session.client.destroy();
        delete sessions[userId];
        removeClient(userId);
        qrCodes.delete(userId);
        const sessionPath = path.join(__dirname, '../sessions', userId);
        if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, {
            recursive: true,
            force: true
        });
        await logService.createLog({
            userId: parseInt(userId),
            level: 'INFO',
            message: 'Logged out successfully.'
        });
        return true;
    } catch (err) {
        console.error('Logout failed:', err);
        return false;
    }
}

function getStatus(userId) {
    return sessions[getSessionKey(userId)]?.status || 'not_initialized';
}

async function initActiveSessions() {
    const users = await User.findAll();
    for (const user of users) {
        await startSession(user.id);
    }
}

// ========== Messaging ==========

// Helper delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Cek apakah user mencapai batas rate limit
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

// Ambil client dan semua setting user
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
        console.error('Error in getSettingsAndClient:', err);
        return {
            error: 'Gagal memuat setting pengguna'
        };
    }
}

// Kirim pesan teks WhatsApp
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
        rate_limit_decay
    } = settingsResult;

    const phone = normalizePhoneNumber(rawPhone, country_code);
    if (!phone) {
        return {
            success: false,
            error: 'Nomor tidak valid'
        };
    }

    // Cek rate limit
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

    // Debug log saat development
    if (process.env.NODE_ENV !== 'production') {
        await logService.createLog({
            userId,
            level: 'DEBUG',
            message: `[DEV] Kirim pesan: ${JSON.stringify({
                rawPhone,
                normalized: phone,
                timeout,
                max_retry,
                retry_interval
            })}`
        });
    }

    let attempt = 0;
    let lastError = null;

    while (attempt <= max_retry) {
        try {
            const sendPromise = client.sendMessage(`${phone}@c.us`, message);

            await Promise.race([
                sendPromise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), timeout * 1000)
                )
            ]);

            await History.create({
                userId,
                phone,
                message,
                type: 'text',
                status: 'success',
                source
            });

            return {
                success: true
            };

        } catch (err) {
            lastError = err;
            console.error(`❌ Error kirim pesan (attempt ${attempt}):`, err);

            if (attempt === max_retry) {
                await History.create({
                    userId,
                    phone,
                    message,
                    type: 'text',
                    status: 'failed',
                    source
                });

                return {
                    success: false,
                    error: 'Gagal mengirim pesan',
                    detail: err.message
                };
            }

            attempt++;
            await delay(retry_interval * 1000);
        }
    }
}

async function sendMediaFromUrl(userId, rawPhone, fileUrl, caption, source = 'unknown') {
    const {
        client,
        country_code,
        error
    } = await getSettingsAndClient(userId);
    if (error) return {
        success: false,
        error
    };

    const phone = normalizePhoneNumber(rawPhone, country_code);
    if (!phone) return {
        success: false,
        error: 'Nomor tidak valid'
    };

    try {
        const media = await MessageMedia.fromUrl(fileUrl);
        await client.sendMessage(`${phone}@c.us`, media, {
            caption
        });

        await History.create({
            userId,
            phone,
            message: caption || '[media]',
            type: 'media',
            status: 'success',
            source
        });
        return {
            success: true
        };

    } catch (err) {
        await History.create({
            userId,
            phone,
            message: caption || '[media]',
            type: 'media',
            status: 'failed',
            source
        });
        return {
            success: false,
            error: 'Gagal mengirim media',
            detail: err.message
        };
    }
}

async function sendMediaFromUpload(userId, rawPhone, file, caption, source = 'unknown') {
    const {
        client,
        country_code,
        error
    } = await getSettingsAndClient(userId);
    if (error) return {
        success: false,
        error
    };

    const phone = normalizePhoneNumber(rawPhone, country_code);
    if (!phone) return {
        success: false,
        error: 'Nomor tidak valid'
    };

    try {
        const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);
        await client.sendMessage(`${phone}@c.us`, media, {
            caption
        });

        await History.create({
            userId,
            phone,
            message: caption || `[file: ${file.originalname}]`,
            type: 'file',
            status: 'success',
            source
        });
        return {
            success: true
        };

    } catch (err) {
        await History.create({
            userId,
            phone,
            message: caption || '[file]',
            type: 'file',
            status: 'failed',
            source
        });
        return {
            success: false,
            error: 'Gagal mengirim file',
            detail: err.message
        };
    }
}

async function sendToGroup(userId, groupName, message, source = 'unknown') {
    const {
        client,
        error
    } = await getSettingsAndClient(userId);
    if (error) return {
        success: false,
        error
    };

    try {
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name === groupName);

        if (!group) return {
            success: false,
            error: `Grup "${groupName}" tidak ditemukan`
        };

        await group.sendMessage(message);
        await History.create({
            userId,
            phone: groupName,
            message,
            type: 'group',
            status: 'success',
            source
        });
        return {
            success: true
        };

    } catch (err) {
        await History.create({
            userId,
            phone: groupName,
            message,
            type: 'group',
            status: 'failed',
            source
        });
        return {
            success: false,
            error: 'Gagal kirim ke grup',
            detail: err.message
        };
    }
}

async function sendBulk(userId, phones, message, delayMs = 1000, source = 'unknown') {
    const {
        client,
        country_code,
        error
    } = await getSettingsAndClient(userId);
    if (error) return {
        success: false,
        error
    };

    const results = [];
    const normalizedList = [];
    let hasFailure = false;

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
        try {
            await client.sendMessage(`${phone}@c.us`, message);
            results.push({
                phone,
                success: true
            });
        } catch (err) {
            results.push({
                phone,
                success: false,
                error: err.message
            });
            hasFailure = true;
        }

        await delay(delayMs);
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
