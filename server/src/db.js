import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "app.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    source TEXT NOT NULL CHECK(source IN ('turo_sync','receipt','manual')),
    dedup_key TEXT UNIQUE,
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
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

  CREATE TABLE IF NOT EXISTS turo_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    storage_state_encrypted TEXT,
    status TEXT NOT NULL DEFAULT 'none',
    last_synced_at TEXT
  );
`);

db.prepare(
  `INSERT OR IGNORE INTO turo_session (id, status) VALUES (1, 'none')`
).run();
