const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage()
});
const whatsappService = require('../services/whatsappService');

exports.sendText = async (req, res) => {
    const {
        phone,
        message
    } = req.body;
    const userId = req.userId;
    const source = req.apiClient?.appName || 'api';

    if (!phone || !message) {
        return res.status(400).json({
            error: 'Phone and message are required.'
        });
    }

    const result = await whatsappService.sendText(userId, phone, message, source);
    res.status(result.success ? 200 : 500).json(result);
};

exports.sendMediaByUrl = async (req, res) => {
    const {
        phone,
        fileUrl,
        caption
    } = req.body;
    const userId = req.userId;
    const source = req.apiClient?.appName || 'api';

    if (!phone || !fileUrl) {
        return res.status(400).json({
            error: 'Phone and fileUrl are required.'
        });
    }

    const result = await whatsappService.sendMediaFromUrl(userId, phone, fileUrl, caption, source);
    res.status(result.success ? 200 : 500).json(result);
};

exports.sendMediaUpload = [
    upload.single('file'),
    async (req, res) => {
        const {
            phone,
            caption
        } = req.body;
        const file = req.file;
        const userId = req.userId;
        const source = req.apiClient?.appName || 'api';

        if (!phone || !file) {
            return res.status(400).json({
                error: 'Phone and file are required.'
            });
        }

        const result = await whatsappService.sendMediaFromUpload(userId, phone, file, caption, source);
        res.status(result.success ? 200 : 500).json(result);
    }
];

exports.sendGroupMessage = async (req, res) => {
    const {
        groupName,
        message
    } = req.body;
    const userId = req.userId;
    const source = req.apiClient?.appName || 'api';

    if (!groupName || !message) {
        return res.status(400).json({
            error: 'Group name and message are required.'
        });
    }

    const result = await whatsappService.sendToGroup(userId, groupName, message, source);
    res.status(result.success ? 200 : 500).json(result);
};

exports.sendBulkMessage = async (req, res) => {
    const {
        phones,
        message,
        delay = 1000
    } = req.body;
    const userId = req.userId;
    const source = req.apiClient?.appName || 'api';

    if (!Array.isArray(phones) || !message) {
        return res.status(400).json({
            error: 'Phones (array) and message are required.'
        });
    }

    const result = await whatsappService.sendBulk(userId, phones, message, delay, source, req);
    res.status(200).json(result);
};

exports.checkConnection = async (req, res) => {
    const userId = req.userId;
    const appName = req.apiClient?.appName || 'UnknownApp';

    try {
        const client = whatsappService.getClient(userId);

        if (!client) {
            return res.status(200).json({
                success: true,
                appName, // tampilkan appName
                status: 'not_initialized',
                message: 'Session not started or not found.'
            });
        }

        let state;
        try {
            state = await client.getState();
        } catch (err) {
            state = 'disconnected';
        }

        res.status(200).json({
            success: true,
            appName, // tampilkan appName
            status: state,
            message: `Session is ${state}.`
        });

    } catch (err) {
        console.error('Check connection error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to check connection status.',
            detail: err.message
        });
    }
};

