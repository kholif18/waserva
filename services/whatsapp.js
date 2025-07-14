// Placeholder untuk logika WhatsApp menggunakan Baileys
async function getQR() {
  return '/qr/qr.png'; // sementara QR disimpan sebagai file image
}

async function sendMessage(phone, message) {
  console.log(`Sending message to ${phone}: ${message}`);
  // Tambahkan logika baileys di sini
}

module.exports = { getQR, sendMessage };
