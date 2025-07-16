const {
    ApiClient, 
    User
} = require('../models');

module.exports = async function verifyApiClient(req, res, next) {
    const token = req.headers['x-api-token'];

    if (!token) {
        return res.status(401).json({
            error: 'Missing API token'
        });
    }

    const client = await ApiClient.findOne({
        where: {
            apiToken: token,
            isActive: true
        },
        include: User
    });

    if (!client) {
        return res.status(403).json({
            error: 'Invalid or inactive API token'
        });
    }

    // Inject ke req
    req.apiClient = client;
    req.sessionName = client.sessionName;
    req.userId = client.userId;

    next();
};