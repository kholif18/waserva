const express = require('express');
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
} = require('../../controllers/whatsappController');
const verifyApiClient = require('../../middlewares/verifyApiClient');

const router = express.Router();

router.post('/start', verifyApiClient, startSession);
router.post('/send', verifyApiClient, sendMessage);
router.post('/send-media', verifyApiClient, sendMedia);
router.post('/send-media-upload', verifyApiClient, ...sendMediaUpload); // ⬅️ ini middleware multer + handler
router.post('/send-group', verifyApiClient, sendGroupMessage);
router.get('/logout', verifyApiClient, logoutSession);
router.get('/sessions', verifyApiClient, listSessions);
router.post('/send-bulk', verifyApiClient, sendBulkMessage);
router.get('/status', verifyApiClient, getSessionStatus);

module.exports = router;
