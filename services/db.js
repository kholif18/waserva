const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/waserva.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE
  )`);
});

function validateApiKey(key) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM applications WHERE api_key = ?", [key], (err, row) => {
      if (err) return reject(err);
      resolve(!!row);
    });
  });
}

module.exports = { validateApiKey };
