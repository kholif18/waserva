const {
    Log
} = require('../models');

exports.viewLogPage = (req, res) => {
    res.render('pages/logs', {
        title: 'Log System',
        activePage: 'logs'
    });
};

exports.getUserLogs = async (req, res) => {
    try {
        const userId = req.session.user.id;

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const level = req.query.level || null;

        const where = {
            userId
        };
        if (level) where.level = level;

        const logs = await Log.findAndCountAll({
            where,
            order: [
                ['createdAt', 'DESC']
            ],
            limit,
            offset
        });

        res.json({
            success: true,
            data: logs.rows,
            total: logs.count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch logs.'
        });
    }
};
