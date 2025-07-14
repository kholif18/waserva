const db = require('./db');

async function checkApiKey(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const isValid = await db.validateApiKey(token);
  if (!isValid) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
}

module.exports = { checkApiKey };
