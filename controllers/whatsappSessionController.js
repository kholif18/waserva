const logService = require('../services/logService');
const whatsappService = require('../services/whatsappService');

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
    whatsappService.setSocketInstance(socketIoInstance);
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

    try {
        const result = await whatsappService.startSession(sessionId);
        res.json({
            message: result
        });
    } catch (err) {
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

module.exports = {
    setSocketInstance,
    startSession,
    getSessionStatus,
    logoutSession,
    listSessions,
    renderLoginWhatsApp
};
