const express = require('express');
const router = express.Router();
const controller = require('../../controllers/apiMessageController');
const verifyApiClient = require('../../middlewares/verifyApiClient');

router.post('/send', verifyApiClient, controller.sendText);
router.post('/send-media-url', verifyApiClient, controller.sendMediaByUrl);
router.post('/send-media', verifyApiClient, controller.sendMediaUpload);
router.post('/send-group', verifyApiClient, controller.sendGroupMessage);
router.post('/send-bulk', verifyApiClient, controller.sendBulkMessage);

router.get('/check-connection', verifyApiClient, controller.checkConnection);
module.exports = router;
