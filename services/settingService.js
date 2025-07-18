const {
    Setting
} = require('../models');

async function getUserSettings(userId) {
    const keys = [
        'timeout', // maksimal waktu tunggu pengiriman pesan (detik)
        'max_retry', // berapa kali mencoba ulang jika gagal
        'retry_interval', // jeda antar percobaan (detik)
        'max_queue', // maksimum jumlah antrean pesan
        'rate_limit_limit', // batas pesan yang boleh dikirim dalam interval waktu tertentu
        'rate_limit_decay', // interval waktu rate limit (detik)
        'country_code' // kode negara default untuk normalisasi nomor
    ];

    console.log('🔍 Mencari setting untuk userId:', userId);

    const rows = await Setting.findAll({
        where: {
            userId
        }
    });

    // Debug tampilkan hasil query sebagai tabel
    console.table(rows.map(r => ({
        key: r.key,
        value: r.value
    })));

    const numericKeys = new Set([
        'timeout',
        'max_retry',
        'retry_interval',
        'max_queue',
        'rate_limit_limit',
        'rate_limit_decay'
    ]);

    const result = {};

    for (const key of keys) {
        const found = rows.find(r => r.key === key);
        let val = found ? found.value : null;

        // Ubah ke number jika kunci termasuk numeric
        if (numericKeys.has(key)) {
            const parsed = parseInt(val, 10);
            val = isNaN(parsed) ? null : parsed;
        }

        result[key] = val;
    }

    // Berikan default jika masih null
    return {
        timeout: result.timeout ?? 30,
        max_retry: result.max_retry ?? 3,
        retry_interval: result.retry_interval ?? 10,
        max_queue: result.max_queue ?? 100,
        rate_limit_limit: result.rate_limit_limit ?? 10,
        rate_limit_decay: result.rate_limit_decay ?? 60,
        country_code: result.country_code ?? '62'
    };
}

module.exports = {
    getUserSettings
};
