const express = require('express');
const router = express.Router();
const {
    startSession,
    sendMessage,
    sendMedia,
    sendMediaUpload,
    sendGroupMessage,
    logoutSession,
    listSessions,
    getSessionStatus,
    sendBulkMessage
} = require('../controllers/whatsappController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.post('/start', isAuthenticated, startSession);
router.post('/send', isAuthenticated, sendMessage);
router.post('/send-media', isAuthenticated, sendMedia);
router.post('/send-media-upload', isAuthenticated, ...sendMediaUpload); // ⬅️ ini middleware multer + handler
router.post('/send-group', isAuthenticated, sendGroupMessage);
router.get('/logout', isAuthenticated, logoutSession);
router.get('/sessions', isAuthenticated, listSessions);
router.post('/send-bulk', isAuthenticated, sendBulkMessage);
router.get('/status', isAuthenticated, getSessionStatus);

module.exports = router;
