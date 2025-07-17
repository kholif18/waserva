const express = require('express');
const router = express.Router();

// Controller: Session (login/logout/status)
const {
    startSession,
    logoutSession,
    listSessions,
    getSessionStatus,
    renderLoginWhatsApp
} = require('../controllers/whatsappSessionController');

// Controller: Message (send text/media/etc)
const {
    viewMessagePage,
    sendMessage,
    sendMedia,
    sendMediaUpload,
    sendGroupMessage,
    sendBulkMessage
} = require('../controllers/whatsappMessageController');

router.get('/login-whatsapp', renderLoginWhatsApp);

// --- SESSION ROUTES ---
router.post('/start', startSession);
router.get('/logout', logoutSession);
router.get('/sessions', listSessions);
router.get('/status', getSessionStatus);

// --- MESSAGE ROUTES ---
router.get('/message', viewMessagePage);
router.post('/send', sendMessage);
router.post('/send-media', sendMedia);
router.post('/send-media-upload', ...sendMediaUpload);
router.post('/send-group', sendGroupMessage);
router.post('/send-bulk', sendBulkMessage);

module.exports = router;
