const path = require('path');
const fs   = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'attendance.db');

let _db = null;

async function getDB() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }
  _db.run(`
    CREATE TABLE IF NOT EXISTS time_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      type       TEXT NOT NULL,
      stamped_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  save();
  return _db;
}

function save() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

module.exports = { getDB, save };