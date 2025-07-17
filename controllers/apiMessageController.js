const {
    MessageMedia
} = require('whatsapp-web.js');
const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage()
});
const {
    History,
    Setting
} = require('../models');
const {
    normalizePhoneNumber
} = require('../utils/phone');

const clients = global.clients;

function getClient(sessionName) {
    return clients.get(sessionName);
}

async function getCountryCode(userId) {
    const setting = await Setting.findOne({
        where: {
            userId,
            key: 'country_code'
        }
    });
    return setting?.value || '62';
}

exports.sendText = async (req, res) => {
    const {
        phone,
        message
    } = req.body;
    const sessionName = req.sessionName;
    const userId = req.userId;

    if (!phone || !message) {
        return res.status(400).json({
            error: 'Phone and message are required.'
        });
    }

    const client = getClient(sessionName);
    if (!client) {
        return res.status(400).json({
            error: 'WhatsApp session not connected.'
        });
    }

    try {
        const normalized = normalizePhoneNumber(phone, await getCountryCode(userId));
        await client.sendMessage(`${normalized}@c.us`, message);

        await History.create({
            userId,
            phone: normalized,
            message,
            status: 'success',
            type: 'api',
            sessionName
        });

        res.json({
            success: true
        });
    } catch (err) {
        await History.create({
            userId,
            phone,
            message,
            status: 'failed',
            type: 'api',
            sessionName
        });
        res.status(500).json({
            error: 'Failed to send message.',
            detail: err.message
        });
    }
};

exports.sendMediaByUrl = async (req, res) => {
    const {
        phone,
        fileUrl,
        caption
    } = req.body;
    const sessionName = req.sessionName;
    const userId = req.userId;

    if (!phone || !fileUrl) {
        return res.status(400).json({
            error: 'Phone and fileUrl are required.'
        });
    }

    const client = getClient(sessionName);
    if (!client) {
        return res.status(400).json({
            error: 'WhatsApp session not connected.'
        });
    }

    try {
        const normalized = normalizePhoneNumber(phone, await getCountryCode(userId));
        const media = await MessageMedia.fromUrl(fileUrl);

        await client.sendMessage(`${normalized}@c.us`, media, {
            caption
        });

        await History.create({
            userId,
            phone: normalized,
            message: caption || '[media]',
            type: 'media',
            sessionName,
            status: 'success'
        });

        res.json({
            success: true
        });
    } catch (err) {
        await History.create({
            userId,
            phone,
            message: caption || '[media]',
            type: 'media',
            sessionName,
            status: 'failed'
        });

        res.status(500).json({
            error: 'Failed to send media.',
            detail: err.message
        });
    }
};

exports.sendMediaUpload = [
    upload.single('file'),
    async (req, res) => {
        const {
            phone,
            caption
        } = req.body;
        const file = req.file;
        const sessionName = req.sessionName;
        const userId = req.userId;

        if (!phone || !file) {
            return res.status(400).json({
                error: 'Phone and file are required.'
            });
        }

        const client = getClient(sessionName);
        if (!client) {
            return res.status(400).json({
                error: 'WhatsApp session not connected.'
            });
        }

        try {
            const normalized = normalizePhoneNumber(phone, await getCountryCode(userId));
            const media = new MessageMedia(file.mimetype, file.buffer.toString('base64'), file.originalname);

            await client.sendMessage(`${normalized}@c.us`, media, {
                caption
            });

            await History.create({
                userId,
                phone: normalized,
                message: caption || `[file: ${file.originalname}]`,
                type: 'file',
                sessionName,
                status: 'success'
            });

            res.json({
                success: true
            });
        } catch (err) {
            await History.create({
                userId,
                phone,
                message: caption || '[file]',
                type: 'file',
                sessionName,
                status: 'failed'
            });

            res.status(500).json({
                error: 'Failed to send uploaded file.',
                detail: err.message
            });
        }
    }
];

exports.sendGroupMessage = async (req, res) => {
    const {
        groupName,
        message
    } = req.body;
    const sessionName = req.sessionName;
    const userId = req.userId;

    if (!groupName || !message) {
        return res.status(400).json({
            error: 'Group name and message are required.'
        });
    }

    const client = getClient(sessionName);
    if (!client) {
        return res.status(400).json({
            error: 'WhatsApp session not connected.'
        });
    }

    try {
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name === groupName);

        if (!group) {
            return res.status(404).json({
                error: `Group "${groupName}" not found.`
            });
        }

        await group.sendMessage(message);

        await History.create({
            userId,
            phone: groupName,
            message,
            type: 'group',
            sessionName,
            status: 'success'
        });

        res.json({
            success: true
        });
    } catch (err) {
        await History.create({
            userId,
            phone: groupName,
            message,
            type: 'group',
            sessionName,
            status: 'failed'
        });

        res.status(500).json({
            error: 'Failed to send to group.',
            detail: err.message
        });
    }
};

exports.sendBulkMessage = async (req, res) => {
    const {
        phones,
        message,
        delay = 1000
    } = req.body;
    const sessionName = req.sessionName;
    const userId = req.userId;

    if (!Array.isArray(phones) || !message) {
        return res.status(400).json({
            error: 'Phones (array) and message are required.'
        });
    }

    const client = getClient(sessionName);
    if (!client) {
        return res.status(400).json({
            error: 'WhatsApp session not connected.'
        });
    }

    const results = [];
    const normalizedList = [];
    let hasFailure = false;

    for (const phone of phones) {
        const normalized = normalizePhoneNumber(phone, await getCountryCode(userId));
        if (!normalized) {
            results.push({
                phone,
                success: false,
                error: 'Invalid number'
            });
            hasFailure = true;
            continue;
        }

        normalizedList.push(normalized);

        try {
            await client.sendMessage(`${normalized}@c.us`, message);
            results.push({
                phone: normalized,
                success: true
            });
        } catch (err) {
            results.push({
                phone: normalized,
                success: false,
                error: err.message
            });
            hasFailure = true;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
    }

    await History.create({
        userId,
        phone: normalizedList.join(', '),
        message,
        type: 'bulk',
        sessionName,
        status: hasFailure ? 'failed' : 'success'
    });

    res.json({
        success: true,
        results
    });
};
