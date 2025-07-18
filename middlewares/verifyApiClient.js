const {
    ApiClient,
    User
} = require('../models');

module.exports = async function verifyApiClient(req, res, next) {
    try {
        const token = req.headers['x-api-token'];

        if (!token) {
            return res.status(401).json({
                error: 'Missing API token. Please provide x-api-token header.'
            });
        }

        const client = await ApiClient.findOne({
            where: {
                apiToken: token,
                isActive: true
            },
            include: [{
                model: User,
                as: 'User', // tambahkan ini
                attributes: ['id', 'username', 'email']
            }]
        });

        if (!client) {
            return res.status(403).json({
                error: 'Invalid or inactive API token.'
            });
        }

        req.apiClient = client;
        req.sessionName = client.sessionName;
        req.userId = client.userId;

        next();
    } catch (err) {
        console.error('API token verification error:', err);
        res.status(500).json({
            error: 'Internal server error during API token verification'
        });
    }
};
