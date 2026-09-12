// db.js — conexão e schema do SQLite (shs.db)
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'shs.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    _email TEXT UNIQUE NOT NULL,
    _permission TEXT NOT NULL DEFAULT 'user',
    _password TEXT NOT NULL,
    _ip TEXT,
    token TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
