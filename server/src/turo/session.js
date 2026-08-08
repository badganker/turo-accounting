import { db } from "../db.js";
import { encrypt, decrypt } from "../lib/crypto.js";

// Turo has no public OAuth/API for hosts, and login always requires either an
// SMS code, an email flow, or Google/Apple sign-in — none of which can be
// driven unattended with a stored password, and a deployed server usually
// has no display to show a browser window on anyway. So the interactive
// login itself runs locally (see server/scripts/connect-turo.js, meant to be
// run on your own machine), which POSTs the resulting session here to be
// encrypted and stored. Sync then reuses that session without ever seeing
// the user's Turo credentials.

export function saveIncomingStorageState(userId, storageState) {
  const encrypted = encrypt(JSON.stringify(storageState));
  db.prepare(
    `INSERT INTO turo_session (user_id, storage_state_encrypted, status, last_synced_at)
     VALUES (@user_id, @encrypted, 'active', NULL)
     ON CONFLICT(user_id) DO UPDATE SET
       storage_state_encrypted = excluded.storage_state_encrypted,
       status = 'active',
       last_synced_at = NULL`
  ).run({ user_id: userId, encrypted });
}

export function getSavedStorageState(userId) {
  const row = db.prepare(`SELECT * FROM turo_session WHERE user_id = ?`).get(userId);
  if (!row || row.status !== "active" || !row.storage_state_encrypted) {
    return null;
  }
  return JSON.parse(decrypt(row.storage_state_encrypted));
}

export function markSessionExpired(userId) {
  db.prepare(`UPDATE turo_session SET status = 'expired' WHERE user_id = ?`).run(userId);
}

export function markSessionSynced(userId) {
  db.prepare(
    `UPDATE turo_session SET last_synced_at = datetime('now') WHERE user_id = ?`
  ).run(userId);
}

export function getSessionStatus(userId) {
  const row = db
    .prepare(`SELECT status, last_synced_at FROM turo_session WHERE user_id = ?`)
    .get(userId);
  return row || { status: "none", last_synced_at: null };
}
