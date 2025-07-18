const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage()
});

const whatsappService = require('../services/whatsappService');

function viewMessagePage(req, res) {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/message', {
        title: 'Message Tester',
        activePage: 'message',
    });
}

async function sendMessage(req, res) {
    const userId = req.session.user.id;
    const {
        phone,
        message
    } = req.body;

    if (!phone || !message) {
        return res.status(400).json({
            success: false,
            error: 'Phone dan message wajib diisi.'
        });
    }

    const source = 'panel';

    const result = await whatsappService.sendText(userId, phone, message, source);
    res.status(result.success ? 200 : 500).json(result);
}

async function sendMedia(req, res) {
    const userId = req.session.user.id;
    const {
        phone,
        fileUrl,
        caption
    } = req.body;
    if (!phone || !fileUrl) {
        return res.status(400).json({
            success: false,
            error: 'Phone dan fileUrl wajib diisi.'
        });
    }

    const source = 'panel';

    const result = await whatsappService.sendMediaFromUrl(userId, phone, fileUrl, caption, source);
    res.status(result.success ? 200 : 500).json(result);
}

const sendMediaUpload = [
    upload.single('file-upload'),
    async (req, res) => {
        const userId = req.session.user.id;
        const {
            phone,
            caption
        } = req.body;
        const file = req.file;
        if (!phone || !file) {
            return res.status(400).json({
                success: false,
                error: 'Phone dan file wajib diisi.'
            });
        }

        const source = 'panel';

        const result = await whatsappService.sendMediaFromUpload(userId, phone, file, caption, source);
        res.status(result.success ? 200 : 500).json(result);
    }
];

async function sendGroupMessage(req, res) {
    const userId = req.session.user.id;
    const {
        groupName,
        message
    } = req.body;
    if (!groupName || !message) {
        return res.status(400).json({
            success: false,
            error: 'Nama grup dan pesan wajib diisi.'
        });
    }
    const source = 'panel';

    const result = await whatsappService.sendToGroup(userId, groupName, message, source);
    res.status(result.success ? 200 : 500).json(result);
}

async function sendBulkMessage(req, res) {
    const userId = req.session.user.id;
    const {
        phones,
        message,
        delay = 1000
    } = req.body;
    if (!Array.isArray(phones) || phones.length === 0 || !message) {
        return res.status(400).json({
            success: false,
            error: 'Daftar nomor dan pesan wajib diisi.'
        });
    }
    const source = 'panel';

    const result = await whatsappService.sendBulk(userId, phones, message, delay, source);
    res.json(result);
}

module.exports = {
    viewMessagePage,
    sendMessage,
    sendMedia,
    sendMediaUpload,
    sendGroupMessage,
    sendBulkMessage
};
