const {
    MessageMedia
} = require('whatsapp-web.js');
const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage()
});
const {
    normalizePhoneNumber
} = require('../utils/phone');
const {
    Setting,
    History
} = require('../models');

const clients = global.clients;

function getSessionId(req) {
    return req.session?.user?.id?.toString();
}

function viewMessagePage(req, res) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

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
    const sessionId = getSessionId(req);
    const {
        phone,
        message
    } = req.body;

    if (!sessionId || !phone || !message) {
        return res.status(400).json({
            error: 'Session, phone, dan message diperlukan'
        });
    }

    if (!clients.has(sessionId)) {
        return res.status(400).json({
            error: 'Session tidak ditemukan'
        });
    }

    const normalizedPhone = await getNormalizedPhone(req, phone);
    if (!normalizedPhone) {
        return res.status(400).json({
            error: 'Nomor tidak valid'
        });
    }

    try {
        const client = clients.get(sessionId);
        await client.sendMessage(`${normalizedPhone}@c.us`, message);

        await History.create({
            userId: req.session.user.id,
            phone: normalizedPhone,
            message,
            status: 'success',
            type: 'tester',
            sessionName: sessionId
        });

        res.json({
            success: true
        });
    } catch (err) {
        await History.create({
            userId: req.session.user.id,
            phone: normalizedPhone,
            message,
            status: 'failed',
            type: 'tester',
            sessionName: sessionId
        });

        res.status(500).json({
            error: 'Gagal mengirim pesan',
            detail: err.message
        });
    }
}

async function sendMedia(req, res) {
    const sessionId = getSessionId(req);
    const {
        phone,
        fileUrl,
        caption
    } = req.body;

    if (!sessionId || !phone || !fileUrl) {
        return res.status(400).json({
            error: 'Session, phone, dan fileUrl diperlukan'
        });
    }

    if (!clients.has(sessionId)) {
        return res.status(400).json({
            error: 'Session tidak ditemukan'
        });
    }

    const normalizedPhone = await getNormalizedPhone(req, phone);
    if (!normalizedPhone) {
        return res.status(400).json({
            error: 'Nomor tidak valid'
        });
    }

    try {
        const client = clients.get(sessionId);
        const media = await MessageMedia.fromUrl(fileUrl);
        await client.sendMessage(`${normalizedPhone}@c.us`, media, {
            caption
        });

        await History.create({
            userId: req.session.user.id,
            phone: normalizedPhone,
            message: caption || '[media]',
            type: 'media',
            sessionName: sessionId,
            status: 'success'
        });

        res.json({
            success: true
        });
    } catch (err) {
        await History.create({
            userId: req.session.user.id,
            phone: normalizedPhone,
            message: caption || '[media]',
            type: 'media',
            sessionName: sessionId,
            status: 'failed'
        });

        res.status(500).json({
            error: 'Gagal mengirim media',
            detail: err.message
        });
    }
}

const sendMediaUpload = [
    upload.single('file-upload'),
    async (req, res) => {
        const sessionId = getSessionId(req);
        const {
            phone,
            caption
        } = req.body;
        const file = req.file;

        if (!sessionId || !phone || !file) {
            return res.status(400).json({
                error: 'Session, phone, dan file wajib diisi'
            });
        }

        if (!clients.has(sessionId)) {
            return res.status(400).json({
                error: 'Session tidak ditemukan'
            });
        }

        const normalizedPhone = await getNormalizedPhone(req, phone);
        if (!normalizedPhone) {
            return res.status(400).json({
                error: 'Nomor tidak valid'
            });
        }

        try {
            const client = clients.get(sessionId);
            const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);
            await client.sendMessage(`${normalizedPhone}@c.us`, media, {
                caption
            });

            await History.create({
                userId: req.session.user.id,
                phone: normalizedPhone,
                message: caption || `[file: ${file.originalname}]`,
                type: 'file',
                sessionName: sessionId,
                status: 'success'
            });

            res.json({
                success: true
            });
        } catch (err) {
            await History.create({
                userId: req.session.user.id,
                phone: normalizedPhone,
                message: caption || '[file]',
                type: 'file',
                sessionName: sessionId,
                status: 'failed'
            });

            res.status(500).json({
                error: 'Gagal mengirim file',
                detail: err.message
            });
        }
    }
];

async function sendGroupMessage(req, res) {
    const sessionId = getSessionId(req);
    const {
        groupName,
        message
    } = req.body;

    if (!sessionId || !groupName || !message) {
        return res.status(400).json({
            error: 'Session, groupName, dan message diperlukan'
        });
    }

    if (!clients.has(sessionId)) {
        return res.status(400).json({
            error: 'Session tidak ditemukan'
        });
    }

    try {
        const client = clients.get(sessionId);
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name === groupName);

        if (!group) {
            return res.status(404).json({
                error: `Grup "${groupName}" tidak ditemukan`
            });
        }

        await group.sendMessage(message);

        await History.create({
            userId: req.session.user.id,
            phone: groupName,
            message,
            type: 'group',
            sessionName: sessionId,
            status: 'success'
        });

        res.json({
            success: true
        });
    } catch (err) {
        await History.create({
            userId: req.session.user.id,
            phone: groupName,
            message,
            type: 'group',
            sessionName: sessionId,
            status: 'failed'
        });

        res.status(500).json({
            error: 'Gagal kirim ke grup',
            detail: err.message
        });
    }
}

async function sendBulkMessage(req, res) {
    const sessionId = getSessionId(req);
    const {
        phones,
        message,
        delay = 1000
    } = req.body;

    if (!sessionId || !Array.isArray(phones) || !message) {
        return res.status(400).json({
            error: 'Session, daftar nomor, dan pesan diperlukan'
        });
    }

    if (!clients.has(sessionId)) {
        return res.status(400).json({
            error: 'Session tidak ditemukan'
        });
    }

    const client = clients.get(sessionId);
    const results = [];
    const normalizedList = [];
    let hasFailure = false;

    for (const phone of phones) {
        const normalizedPhone = await getNormalizedPhone(req, phone);
        if (!normalizedPhone) {
            results.push({
                phone,
                success: false,
                error: 'Nomor tidak valid'
            });
            hasFailure = true;
            continue;
        }

        normalizedList.push(normalizedPhone);

        try {
            await client.sendMessage(`${normalizedPhone}@c.us`, message);
            results.push({
                phone: normalizedPhone,
                success: true
            });
        } catch (err) {
            results.push({
                phone: normalizedPhone,
                success: false,
                error: err.message
            });
            hasFailure = true;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
    }

    await History.create({
        userId: req.session.user.id,
        phone: normalizedList.join(', '),
        message,
        type: 'bulk',
        sessionName: sessionId,
        status: hasFailure ? 'failed' : 'success'
    });

    res.json({
        results
    });
}

module.exports = {
    viewMessagePage,
    sendMessage,
    sendMedia,
    sendMediaUpload,
    sendGroupMessage,
    sendBulkMessage
};
