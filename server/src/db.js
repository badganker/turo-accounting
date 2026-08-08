import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR points at a mounted persistent volume in production (see
// fly.toml) so a redeploy's new code doesn't shadow stored data.
const dataDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "db")
  : path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "app.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    source TEXT NOT NULL CHECK(source IN ('turo_sync','receipt','manual')),
    dedup_key TEXT,
    date TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    category TEXT,
    vehicle TEXT,
    description TEXT,
    reservation_id TEXT,
    receipt_path TEXT,
    raw_data TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, dedup_key)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);

  CREATE TABLE IF NOT EXISTS turo_session (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    storage_state_encrypted TEXT,
    status TEXT NOT NULL DEFAULT 'none',
    last_synced_at TEXT
  );
`);
