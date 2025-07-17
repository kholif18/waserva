const {
    Client,
    LocalAuth,
    MessageMedia
} = require('whatsapp-web.js');
const qrcode = require('qrcode');
const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const {
    logToGateway
} = require('../services/logService');
const {
    isValidPhoneNumber
} = require('libphonenumber-js');

dotenv.config();

global.sessions = global.sessions || {};
const clients = new Map();
const qrCodes = new Map();
global.qrCodes = qrCodes;
let io = null;

const upload = multer({
    storage: multer.memoryStorage()
});

function renderLoginWhatsApp(req, res) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    res.render('pages/login-whatsapp', {
        title: 'Login WhatsApp',
        activePage: 'login-whatsapp',
        user: req.session.user
    });
}

function setSocketInstance(socketIoInstance) {
    io = socketIoInstance;
}

async function startSession(req, res) {
    const sessionId = req.sessionName || req.session?.user?.username || req.body.session;
    if (!sessionId) {
        return res.status(400).json({
            error: 'Session ID diperlukan'
        });
    }

    if (clients.has(sessionId)) {
        return res.json({
            message: 'Session sudah aktif'
        });
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: sessionId,
            dataPath: path.join(__dirname, '../../sessions')
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
        },
    });

    global.sessions[sessionId] = {
        client,
        qr: null,
        status: 'starting'
    };

    if (io) io.to(sessionId).emit('session:update', {
        session: sessionId,
        status: 'starting'
    });

    client.on('message', async (msg) => {
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) return;

        const payload = {
            session: sessionId,
            from: msg.from,
            to: msg.to || sessionId,
            body: msg.body,
            type: msg.type,
            timestamp: msg.timestamp,
            isGroupMsg: msg.from.endsWith('@g.us'),
        };

        try {
            await axios.post(webhookUrl, payload);
            console.log(`📬 Webhook dikirim ke ${webhookUrl}`);
        } catch (err) {
            console.error('❌ Gagal kirim webhook:', err.message);
        }
    });

    client.on('qr', async (qr) => {
        try {
            const qrImage = await qrcode.toDataURL(qr);
            global.qrCodes.set(sessionId, qrImage);
            global.sessions[sessionId].status = 'qr';

            if (io) io.to(sessionId).emit('session:qr', {
                session: sessionId,
                qr: qrImage
            });

            console.log(`✅ QR dikirim via socket untuk ${sessionId}`);

            setTimeout(() => {
                global.qrCodes.delete(sessionId);
                console.log(`🗑 QR expired untuk ${sessionId}`);
            }, 60000);
        } catch (err) {
            console.error(`❌ Gagal generate QR:`, err);
        }
    });

    client.on('ready', () => {
        global.sessions[sessionId].status = 'connected';
        if (io) io.to(sessionId).emit('session:update', {
            session: sessionId,
            status: 'connected'
        });
    });

    client.on('auth_failure', msg => {
        global.sessions[sessionId].status = 'auth_failure';
        if (io) io.to(sessionId).emit('session:update', {
            session: sessionId,
            status: 'auth_failure'
        });
        clients.delete(sessionId);
        global.qrCodes.delete(sessionId);
    });

    client.on('disconnected', async (reason) => {
        global.sessions[sessionId].status = 'disconnected';
        if (io) io.to(sessionId).emit('session:update', {
            session: sessionId,
            status: 'disconnected',
            reason
        });

        try {
            await client.destroy();
        } catch (e) {
            console.error(`❌ Gagal destroy client ${sessionId}:`, e);
        }

        clients.delete(sessionId);
        global.qrCodes.delete(sessionId);

        if (reason !== 'LOGOUT') {
            console.log(`🔁 Restarting session ${sessionId} in 5s...`);
            setTimeout(() => {
                startSession({
                    body: {
                        session: sessionId
                    }
                }, {
                    json: () => {}
                });
            }, 5000);
        }
    });

    try {
        await client.initialize();
        clients.set(sessionId, client);
        res.json({
            message: 'Session starting...'
        });
    } catch (err) {
        console.error(`❌ Gagal initialize session ${sessionId}:`, err);
        res.status(500).json({
            error: 'Gagal memulai sesi',
            detail: err.message || err
        });
    }
}

async function getSessionStatus(req, res) {
    const sessionId = req.sessionName || req.session?.user?.username || req.body.session;
    if (!sessionId) return res.status(400).json({
        error: 'Session ID diperlukan'
    });

    const session = global.sessions[sessionId];
    if (!session) return res.status(404).json({
        error: 'Session tidak ditemukan'
    });

    res.json({
        session: sessionId,
        status: session.status || 'unknown'
    });
}

async function sendMessage(req, res) {
    const sessionId = req.sessionName || req.session?.user?.username || req.body.session;
    const {
        phone,
        message
    } = req.body;

    if (!sessionId || !phone || !message) return res.status(400).json({
        error: 'Session, phone, dan message diperlukan'
    });
    if (!isValidPhoneNumber(phone, 'ID')) return res.status(400).json({
        error: 'Nomor telepon tidak valid'
    });
    if (!clients.has(sessionId)) return res.status(400).json({
        error: 'Session tidak ditemukan'
    });

    try {
        const client = clients.get(sessionId);
        await client.sendMessage(`${phone}@c.us`, message);
        await logToGateway({
            session: sessionId,
            phone,
            message,
            type: 'text',
            status: 'success'
        });

        res.json({
            success: true
        });

        if (!fs.existsSync('logs')) fs.mkdirSync('logs');
        fs.appendFileSync('logs/messages.log', `[${new Date().toISOString()}] ${sessionId} -> ${phone}: ${message}\n`);
    } catch (err) {
        await logToGateway({
            session: sessionId,
            phone,
            message,
            type: 'text',
            status: 'failed'
        });
        res.status(500).json({
            error: 'Gagal mengirim pesan',
            detail: err.message
        });
    }
}

async function sendMedia(req, res) {
    const sessionId = req.sessionName || req.session?.user?.username || req.body.session;
    const {
        phone,
        fileUrl,
        caption
    } = req.body;

    if (!sessionId || !phone || !fileUrl) return res.status(400).json({
        error: 'Session, phone, dan fileUrl diperlukan'
    });
    if (!isValidPhoneNumber(phone, 'ID')) return res.status(400).json({
        error: 'Nomor telepon tidak valid'
    });
    if (!clients.has(sessionId)) return res.status(400).json({
        error: 'Session tidak ditemukan'
    });

    try {
        const client = clients.get(sessionId);
        const media = await MessageMedia.fromUrl(fileUrl);
        await client.sendMessage(`${phone}@c.us`, media, {
            caption
        });

        await logToGateway({
            session: sessionId,
            phone,
            message: caption || '[media]',
            type: 'media',
            status: 'success'
        });

        res.json({
            success: true
        });
    } catch (err) {
        await logToGateway({
            session: sessionId,
            phone,
            message: caption || '[media]',
            type: 'media',
            status: 'failed'
        });
        res.status(500).json({
            error: 'Gagal mengirim media',
            detail: err.message
        });
    }
}

const sendMediaUpload = [
    upload.single('file'),
    async (req, res) => {
        const sessionId = req.sessionName || req.session?.user?.username || req.body.session;
        const {
            phone,
            caption
        } = req.body;
        const file = req.file;

        if (!sessionId || !phone || !file) return res.status(400).json({
            error: 'Session, phone, dan file wajib diisi'
        });
        if (!clients.has(sessionId)) return res.status(400).json({
            error: 'Session tidak ditemukan'
        });

        try {
            const client = clients.get(sessionId);
            const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);
            await client.sendMessage(`${phone}@c.us`, media, {
                caption
            });

            await logToGateway({
                session: sessionId,
                phone,
                message: caption || `[file: ${file.originalname}]`,
                type: 'file',
                status: 'success'
            });

            res.json({
                success: true
            });
        } catch (err) {
            await logToGateway({
                session: sessionId,
                phone,
                message: caption || '[file]',
                type: 'file',
                status: 'failed'
            });

            res.status(500).json({
                error: 'Gagal mengirim file',
                detail: err.message
            });
        }
    }
];

async function sendGroupMessage(req, res) {
    const sessionId = req.sessionName || req.session?.user?.username || req.body.session;
    const {
        groupName,
        message
    } = req.body;

    if (!sessionId || !groupName || !message) return res.status(400).json({
        error: 'Session, groupName, dan message diperlukan'
    });
    if (!clients.has(sessionId)) return res.status(400).json({
        error: 'Session tidak ditemukan'
    });

    try {
        const client = clients.get(sessionId);
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name === groupName);

        if (!group) return res.status(404).json({
            error: `Grup "${groupName}" tidak ditemukan`
        });

        await group.sendMessage(message);

        await logToGateway({
            session: sessionId,
            phone: groupName,
            message,
            type: 'group',
            status: 'success'
        });

        res.json({
            success: true
        });
    } catch (err) {
        await logToGateway({
            session: sessionId,
            phone: groupName,
            message,
            type: 'group',
            status: 'failed'
        });

        res.status(500).json({
            error: 'Gagal kirim ke grup',
            detail: err.message
        });
    }
}

async function sendBulkMessage(req, res) {
    const sessionId = req.sessionName || req.session?.user?.username || req.body.session;
    const {
        messages,
        delay = 1000
    } = req.body;

    if (!sessionId || !Array.isArray(messages)) {
        return res.status(400).json({
            error: 'Session dan daftar messages diperlukan'
        });
    }

    if (!clients.has(sessionId)) return res.status(400).json({
        error: 'Session tidak ditemukan'
    });

    const client = clients.get(sessionId);
    const results = [];

    for (const {
            phone,
            message
        } of messages) {
        if (!isValidPhoneNumber(phone, 'ID')) {
            results.push({
                phone,
                success: false,
                error: 'Nomor tidak valid'
            });
            continue;
        }

        try {
            await client.sendMessage(`${phone}@c.us`, message);
            results.push({
                phone,
                success: true
            });

            await logToGateway({
                session: sessionId,
                phone,
                message,
                type: 'bulk',
                status: 'success'
            });
        } catch (err) {
            results.push({
                phone,
                success: false,
                error: err.message
            });

            await logToGateway({
                session: sessionId,
                phone,
                message,
                type: 'bulk',
                status: 'failed'
            });
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    res.json({
        results
    });
}

async function logoutSession(req, res) {
    const sessionId = req.sessionName || req.session?.user?.username || req.body.session;

    if (!sessionId) return res.status(400).json({
        error: 'Session ID diperlukan'
    });

    const session = global.sessions[sessionId];
    if (!session) return res.status(404).json({
        error: 'Session tidak ditemukan'
    });

    if (session.status !== 'connected') {
        return res.status(400).json({
            error: 'Session belum login, tidak bisa logout'
        });
    }

    try {
        await session.client.logout();
        await session.client.destroy();

        delete global.sessions[sessionId];
        global.qrCodes.delete(sessionId);
        clients.delete(sessionId);

        // Optional: hapus folder sesi
        const sessionPath = path.resolve(__dirname, '../../sessions', sessionId);
        if (fs.existsSync(path.join(sessionPath, 'SingletonLock'))) {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
        }

        res.json({
            success: true,
            message: `Session ${sessionId} berhasil logout dan dihapus`
        });
    } catch (err) {
        res.status(500).json({
            error: 'Gagal logout session',
            detail: err.message
        });
    }
}

async function listSessions(req, res) {
    const currentSessionId = req.sessionName || req.session?.user?.username;

    if (!currentSessionId) {
        return res.status(403).json({
            error: 'Unauthorized'
        });
    }

    const session = global.sessions[currentSessionId];
    if (!session) {
        return res.status(404).json({
            error: 'Session tidak ditemukan'
        });
    }

    res.json({
        session: currentSessionId,
        status: session.status || 'unknown'
    });
}


module.exports = {
    setSocketInstance,
    startSession,
    getSessionStatus,
    sendMessage,
    sendMedia,
    sendMediaUpload,
    sendGroupMessage,
    logoutSession,
    listSessions,
    sendBulkMessage,
    renderLoginWhatsApp
};
