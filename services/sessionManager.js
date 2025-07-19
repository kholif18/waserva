const {
    Client
} = require('whatsapp-web.js');

// Global Maps for persistence across reloads
const clients = global.clients = global.clients || new Map();
const sessions = global.sessions = global.sessions || {};
const qrCodes = global.qrCodes = global.qrCodes || new Map();

// Util
function getSessionKey(userId) {
    return userId.toString();
}

// === Clients ===
function getClient(userId) {
    return clients.get(getSessionKey(userId)) || null;
}

function setClient(userId, client) {
    clients.set(getSessionKey(userId), client);
}

function removeClient(userId) {
    clients.delete(getSessionKey(userId));
}

function getAllClients() {
    return clients;
}

// === Sessions ===
function getSession(userId) {
    return sessions[getSessionKey(userId)];
}

function setSession(userId, data) {
    sessions[getSessionKey(userId)] = data;
}

function removeSession(userId) {
    delete sessions[getSessionKey(userId)];
}

function getAllSessions() {
    return sessions;
}

// === QR Codes ===
function getQrCode(userId) {
    return qrCodes.get(getSessionKey(userId)) || null;
}

function setQrCode(userId, qrImage) {
    qrCodes.set(getSessionKey(userId), qrImage);
}

function removeQrCode(userId) {
    qrCodes.delete(getSessionKey(userId));
}

function getAllQrCodes() {
    return qrCodes;
}

// Export everything needed
module.exports = {
    getSessionKey,

    // Client handlers
    clients,
    getClient,
    setClient,
    removeClient,
    getAllClients,

    // Session handlers
    sessions,
    getSession,
    setSession,
    removeSession,
    getAllSessions,

    // QR Code handlers
    qrCodes,
    getQrCode,
    setQrCode,
    removeQrCode,
    getAllQrCodes
};
