// Gunakan map global untuk menyimpan client per user
const clients = global.clients = global.clients || new Map();

/**
 * Ambil client WhatsApp berdasarkan userId
 * @param {number|string} userId
 * @returns {Client|null}
 */
function getClient(userId) {
    return clients.get(String(userId)) || null;
}

/**
 * Set atau daftarkan client WhatsApp baru untuk userId
 * @param {number|string} userId
 * @param {Client} clientInstance
 */
function setClient(userId, clientInstance) {
    clients.set(String(userId), clientInstance);
}

/**
 * Hapus client WhatsApp dari daftar (biasanya saat logout / disconnect)
 * @param {number|string} userId
 */
function removeClient(userId) {
    clients.delete(String(userId));
}

/**
 * Ambil semua client aktif (opsional, jika mau tampilkan di dashboard misalnya)
 * @returns {Map<string, Client>}
 */
function getAllClients() {
    return clients;
}

module.exports = {
    getClient,
    setClient,
    removeClient,
    getAllClients
};
