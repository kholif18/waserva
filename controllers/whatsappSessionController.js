const logService = require('../services/logService');
const {
    Client,
    LocalAuth
} = require('whatsapp-web.js');
const qrcode = require('qrcode');
const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

dotenv.config();

global.sessions = global.sessions || {};
const clients = new Map();
global.clients = clients;
const qrCodes = new Map();
global.qrCodes = qrCodes;
let io = null;

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

function getSessionId(req) {
    return req.session?.user?.id?.toString();
}

async function startSession(req, res) {
    const sessionId = getSessionId(req);
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

    client.on('ready', async () => {
        global.sessions[sessionId].status = 'connected';
        if (io) io.to(sessionId).emit('session:update', {
            session: sessionId,
            status: 'connected'
        });

        await logService.createLog({
            userId: parseInt(sessionId),
            level: 'INFO',
            message: 'WhatsApp session connected.'
        });
    });

    client.on('auth_failure', async msg => {
        global.sessions[sessionId].status = 'auth_failure';
        if (io) io.to(sessionId).emit('session:update', {
            session: sessionId,
            status: 'auth_failure'
        });

        clients.delete(sessionId);
        global.qrCodes.delete(sessionId);

        await logService.createLog({
            userId: parseInt(sessionId),
            level: 'ERROR',
            message: 'WhatsApp session authentication failed.'
        });
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
                    session: {
                        user: {
                            id: sessionId
                        }
                    }
                }, {
                    json: () => {}
                });
            }, 5000);
        };
        
        await logService.createLog({
            userId: parseInt(sessionId),
            level: 'WARN',
            message: `WhatsApp session disconnected. Reason: ${reason}`
        });
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
    const sessionId = getSessionId(req);
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

async function logoutSession(req, res) {
    const sessionId = getSessionId(req);

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

        const sessionPath = path.resolve(__dirname, '../../sessions', sessionId);
        if (fs.existsSync(path.join(sessionPath, 'SingletonLock'))) {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
        }

        await logService.createLog({
            userId: parseInt(sessionId),
            level: 'INFO',
            message: 'WhatsApp session logged out and removed.'
        });
        
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
    const sessionId = getSessionId(req);
    if (!sessionId) return res.status(403).json({
        error: 'Unauthorized'
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

module.exports = {
    setSocketInstance,
    startSession,
    getSessionStatus,
    logoutSession,
    listSessions,
    renderLoginWhatsApp
};
