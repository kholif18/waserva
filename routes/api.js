const express = require('express');
const router = express.Router();
const { checkApiKey } = require('../services/auth');
const { sendMessage } = require('../services/whatsapp');

router.post('/send', checkApiKey, async (req, res) => {
  const { phone, message } = req.body;
  try {
    await sendMessage(phone, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
