const {
    Op
} = require('sequelize');
const {
    History
} = require('../models');
const paginate = require('../utils/pagination');

exports.index = async (req, res) => {
    const userId = req.session.user.id;

    const {
        fromDate,
        toDate,
        status,
        search,
        page = 1,
        per_page = 10
    } = req.query;

    const limit = parseInt(per_page);
    const offset = (page - 1) * limit;

    let where = {
        userId
    };

    if (fromDate && toDate) {
        where.createdAt = {
            [Op.between]: [new Date(fromDate), new Date(new Date(toDate).setHours(23, 59, 59))]
        };
    }

    if (status) {
        if (status == 1) where.status = 'Success';
        else if (status == 2) where.status = 'Pending';
        else if (status == 3) where.status = 'Failed';
    }

    if (search) {
        where[Op.or] = [{
                phone: {
                    [Op.like]: `%${search}%`
                }
            },
            {
                message: {
                    [Op.like]: `%${search}%`
                }
            },
        ];
    }

    const {
        count,
        rows
    } = await History.findAndCountAll({
        where,
        limit,
        offset,
        order: [
            ['createdAt', 'DESC']
        ]
    });

    function formatDateTime(date) {
        const dateStr = date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        }).replaceAll('/', '-');

        const timeStr = date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/\./g, ':');

        return `${dateStr}, ${timeStr}`;
    }

    function formatMessage(message, type) {
        switch (type) {
            case 'media':
                return `[MediaURL] ${message.replace(/\[file:|\]/g, '')}`;
            case 'file':
                return `[MediaUpload] ${message.replace(/\[file:|\]/g, '')}`;
            case 'bulk':
                return `[Bulk] ${message}`;
            case 'group':
                return `[GroupMessage] ${message}`;
            default:
                return message;
        }
    }

    const history = rows.map(h => ({
        datetime: formatDateTime(h.createdAt),
        to: h.phone,
        message: formatMessage(h.message, h.type),
        status: h.status,
        source: h.source || 'panel'
    }));

    const pagination = paginate('/history', page, limit, count, req.query);

    res.render('pages/history', {
        history,
        pagination,
        req
    });
};

