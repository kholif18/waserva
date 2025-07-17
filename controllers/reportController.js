const {
    Op,
    fn,
    col,
    literal
} = require('sequelize');
const {
    History,
} = require('../models');
const paginate = require('../utils/pagination');

exports.index = async (req, res) => {
    const userId = req.session?.user?.id;
    const {
        fromDate,
        toDate,
        page = 1,
        per_page = 10
    } = req.query;

    const limit = parseInt(per_page);
    const offset = (page - 1) * limit;

    const where = {
        userId
    };

    if (fromDate && toDate) {
        where.createdAt = {
            [Op.between]: [new Date(fromDate), new Date(new Date(toDate).setHours(23, 59, 59))]
        };
    }

    // Group by Date only (not datetime)
    const reportData = await History.findAll({
        attributes: [
            [fn('DATE_FORMAT', col('createdAt'), '%d-%m-%Y'), 'datetime'],
            [fn('COUNT', col('id')), 'count']
        ],
        where,
        group: [literal('DATE(createdAt)')],
        order: [
            [literal('DATE(createdAt)'), 'DESC']
        ],
        limit,
        offset
    });

    const countData = await History.findAll({
        attributes: [
            [fn('COUNT', fn('DISTINCT', fn('DATE', col('createdAt')))), 'total']
        ],
        where
    });

    const total = parseInt(countData[0]?.dataValues ?.total || 0);

    const report = reportData.map(item => ({
        datetime: item.dataValues.datetime,
        count: item.dataValues.count
    }));

    const pagination = paginate('/report', page, limit, total, req.query);

    res.render('pages/report', {
        report,
        pagination,
        req
    });
};
