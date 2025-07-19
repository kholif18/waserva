const logService = require('../services/logService');
const whatsappService = require('../services/whatsappService');
const path = require('path');
const fs = require('fs');
const {
    getSessionKey,
    getClient, 
    removeClient
} = require('../services/sessionManager');

let io = null;

function setSocketInstance(socketIoInstance) {
    io = socketIoInstance;
    whatsappService.setSocketInstance(socketIoInstance);
}

function getSessionId(req) {
    return req.session?.user?.id?.toString();
}

function renderLoginWhatsApp(req, res) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    res.render('pages/login-whatsapp', {
        title: 'Login WhatsApp',
        activePage: 'login-whatsapp',
    });
}

// Fungsi untuk dipanggil dari luar (misalnya: login, register)
async function startUserSession(userId) {
    try {
        const result = await whatsappService.startSession(userId.toString());

        // Kirim event socket manual jika perlu
        if (io) {
            io.to(userId.toString()).emit('session:update', {
                session: userId.toString(),
                status: 'starting'
            });
        }

        return {
            success: true,
            message: result
        };
    } catch (err) {
        await logService.createLog({
            userId,
            level: 'ERROR',
            message: `Gagal memulai sesi WA: ${err.message}`
        });
        return {
            success: false,
            error: err.message || err
        };
    }
}

// Endpoint HTTP (gunakan Express `req`, `res`)
async function startSession(req, res) {
    const sessionId = getSessionId(req);
    if (!sessionId) {
        return res.status(400).json({
            error: 'Session ID diperlukan'
        });
    }

    const result = await startUserSession(sessionId);
    if (result.success) {
        res.json({
            success: true,
            message: result.message
        });
    } else {
        res.status(500).json({
            success: false,
            error: result.error
        });
    }
}

async function getSessionStatus(req, res) {
    const sessionId = getSessionId(req);
    if (!sessionId) return res.status(400).json({
        error: 'Session ID diperlukan'
    });

    try {
        const status = whatsappService.getStatus(sessionId);
        res.json({
            session: sessionId,
            status
        });
    } catch (err) {
        res.status(500).json({
            error: 'Gagal mengambil status session',
            detail: err.message
        });
    }
}

async function logoutSession(req, res) {
    const sessionId = getSessionId(req);
    if (!sessionId) return res.status(400).json({
        error: 'Session ID diperlukan'
    });

    try {
        const result = await whatsappService.logoutSession(sessionId);
        res.json({
            success: true,
            message: result
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

    try {
        const status = whatsappService.getStatus(sessionId);
        res.json({
            session: sessionId,
            status
        });
    } catch (err) {
        res.status(500).json({
            error: 'Gagal mengambil daftar session',
            detail: err.message
        });
    }
}

async function resetSession(req, res) {
    const userId = req.session.user.id;
    const sessionKey = getSessionKey(userId);
    const sessionPath = path.join(__dirname, '../sessions', `session-${sessionKey}`);

    try {
        // ✅ Destroy client jika masih ada
        const client = getClient(sessionKey);
        if (client) {
            await client.destroy(); // ini penting agar lock dilepas
            removeClient(sessionKey);
        }

        // 🧹 Hapus folder session
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
            return res.json({
                success: true,
                message: 'Session folder deleted.'
            });
        } else {
            return res.json({
                success: false,
                message: 'Session folder not found.'
            });
        }
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to delete session.',
            error: err.message
        });
    }
}

module.exports = {
    setSocketInstance,
    startSession,
    getSessionStatus,
    logoutSession,
    listSessions,
    renderLoginWhatsApp,
    startUserSession,
    resetSession
};
