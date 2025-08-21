const {
    ApiClient,
    User
} = require('../models');

module.exports = async function verifyApiClient(req, res, next) {
    try {
        // ambil dari header
        const token = req.headers['x-api-token'];

        // ambil dari body atau query
        const client = req.body.client || req.query.client;
        const secret = req.body.secret || req.query.secret;

        let apiClient = null;

        if (token) {
            // Mode lama: x-api-token
            apiClient = await ApiClient.findOne({
                where: {
                    apiToken: token,
                    isActive: true
                }
            });
        } else if (client && secret) {
            // Mode baru: client + secret
            apiClient = await ApiClient.findOne({
                where: {
                    appName: client,
                    apiToken: secret,
                    isActive: true
                }
            });
        }

        if (!apiClient) {
            return res.status(401).json({
                error: 'Invalid API credentials. Provide x-api-token header or client+secret.'
            });
        }

        // simpan data client untuk controller
        req.apiClient = apiClient;
        req.userId = apiClient.userId;

        next();

    } catch (err) {
        console.error('verifyApiClient error:', err);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
};