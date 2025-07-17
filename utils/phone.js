const {
    parsePhoneNumberFromString
} = require('libphonenumber-js');

/**
 * Menormalkan nomor telepon ke format internasional (e.g. 6281234567890)
 * @param {string} rawPhone - Nomor mentah dari input
 * @param {string} countryCode - Kode negara seperti '62', '60', dst
 * @returns {string|null}
 */
function normalizePhoneNumber(rawPhone, countryCode = '62') {
    if (!rawPhone) return null;

    // Ambil ISO dari countryCode (untuk libphonenumber-js)
    const isoMap = {
        '62': 'ID',
        '60': 'MY',
        '65': 'SG',
        '1': 'US',
        '91': 'IN'
    };
    const iso = isoMap[countryCode] || 'ID';

    // Parse & format
    const parsed = parsePhoneNumberFromString(rawPhone, iso);
    if (!parsed || !parsed.isValid()) return null;

    return parsed.number.replace('+', ''); // contoh: +6281234567890 → 6281234567890
}

module.exports = {
    normalizePhoneNumber
};
