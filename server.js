const express = require('express');
const path    = require('path');
const { getDB, save } = require('./database');

const app     = express();
const BASE_H  = 8.0;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── 打刻ログ取得 ──
app.get('/api/logs/:date', async (req, res) => {
  const db   = await getDB();
  const stmt = db.prepare('SELECT type, stamped_at FROM time_logs WHERE date = ? ORDER BY stamped_at ASC');
  stmt.bind([req.params.date]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  res.json(rows);
});

// ── 打刻処理 ──
app.post('/api/stamp', async (req, res) => {
  const db     = await getDB();
  const action = req.body.action;
  const now    = new Date();
  const today  = now.toLocaleDateString('sv-SE');
  const nowStr = now.toLocaleString('sv-SE').replace('T', ' ');

  const stmt = db.prepare('SELECT type FROM time_logs WHERE date = ? ORDER BY stamped_at DESC LIMIT 1');
  stmt.bind([today]);
  const last     = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  const lastType = last ? last.type : null;

  const validMap = {
    'null':        ['start'],
    'start':       ['break_start', 'end'],
    'break_start': ['break_end'],
    'break_end':   ['break_start', 'end'],
    'end':         [],
  };

  const key = lastType === null ? 'null' : lastType;
  if (!(validMap[key] || []).includes(action)) {
    return res.json({ ok: false, msg: '現在その操作はできません' });
  }

  db.run('INSERT INTO time_logs (date, type, stamped_at) VALUES (?, ?, ?)', [today, action, nowStr]);
  save();

  const msgs = {
    start:       '勤務を開始しました',
    break_start: '休憩を開始しました',
    break_end:   '休憩を終了しました',
    end:         '勤務を終了しました',
  };
  res.json({ ok: true, msg: msgs[action], last_type: action });
});

// ── 集計API ──
app.get('/api/summary', async (req, res) => {
  const db   = await getDB();
  const { from, to } = req.query;
  const stmt = db.prepare(
    'SELECT date, type, stamped_at FROM time_logs WHERE date BETWEEN ? AND ? ORDER BY date, stamped_at'
  );
  stmt.bind([from, to]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();

  const byDate = {};
  for (const row of rows) {
    (byDate[row.date] ??= []).push(row);
  }

  const result = {};
  for (const [date, logs] of Object.entries(byDate)) {
    let workSec = 0, workStart = null;
    for (const log of logs) {
      const t = new Date(log.stamped_at).getTime() / 1000;
      switch (log.type) {
        case 'start':       workStart = t; break;
        case 'break_start': if (workStart) { workSec += t - workStart; workStart = null; } break;
        case 'break_end':   workStart = t; break;
        case 'end':         if (workStart) { workSec += t - workStart; workStart = null; } break;
      }
    }
    if (workStart) workSec += Date.now() / 1000 - workStart;
    result[date] = Math.round(workSec / 36) / 100;
  }
  res.json({ data: result, base: BASE_H });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));