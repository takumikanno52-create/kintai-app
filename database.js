const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'attendance.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS time_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK(type IN ('start','break_start','break_end','end')),
    stamped_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )
`);

module.exports = db;