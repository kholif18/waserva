const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 menit
    max: 5, // maksimal 10 percobaan
    message: 'Terlalu banyak percobaan login. Coba lagi nanti.'
});

module.exports = loginLimiter;
