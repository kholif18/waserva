const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage()
});

const {
    normalizePhoneNumber
} = require('../utils/phone');
const {
    Setting
} = require('../models');
const whatsappService = require('../services/whatsappService');

function viewMessagePage(req, res) {
    if (!req.session.user) return res.redirect('/login');

    res.render('pages/message', {
        title: 'Message Tester',
        activePage: 'message',
        user: req.session.user
    });
}

async function getNormalizedPhone(req, rawPhone) {
    const userId = req.session?.user?.id;
    const setting = await Setting.findOne({
        where: {
            userId,
            key: 'country_code'
        }
    });

    const countryCode = setting?.value || '62';
    return normalizePhoneNumber(rawPhone, countryCode);
}

async function sendMessage(req, res) {
    const userId = req.session.user.id;
    const {
        phone,
        message
    } = req.body;
    const normalizedPhone = await getNormalizedPhone(req, phone);
    const source = 'panel';

    const result = await whatsappService.sendText(userId, normalizedPhone, message, source);
    res.status(result.success ? 200 : 500).json(result);
}

async function sendMedia(req, res) {
    const userId = req.session.user.id;
    const {
        phone,
        fileUrl,
        caption
    } = req.body;
    const normalizedPhone = await getNormalizedPhone(req, phone);
    const source = 'panel';

    const result = await whatsappService.sendMediaFromUrl(userId, normalizedPhone, fileUrl, caption, source);
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
        const normalizedPhone = await getNormalizedPhone(req, phone);
        const source = 'panel';

        const result = await whatsappService.sendMediaFromUpload(userId, normalizedPhone, file, caption, source);
        res.status(result.success ? 200 : 500).json(result);
    }
];

async function sendGroupMessage(req, res) {
    const userId = req.session.user.id;
    const {
        groupName,
        message
    } = req.body;
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
    const source = 'panel';

    const result = await whatsappService.sendBulk(userId, phones, message, delay, req, source);
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
