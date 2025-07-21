const {
    Log
} = require('../models');

exports.viewLogPage = (req, res) => {
    res.render('admin/logs', {
        title: 'Log System',
        activePage: 'logs'
    });
};

exports.getUserLogs = async (req, res) => {
    try {
        const {
            id: userId,
            role
        } = req.session.user;

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const level = req.query.level || null;

        const where = {};

        // Jika bukan admin, filter berdasarkan userId
        if (role !== 'admin') {
            where.userId = userId;
        }

        // Filter level jika ada
        if (level) {
            where.level = level;
        }

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

