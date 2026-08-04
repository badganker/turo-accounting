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

export function saveIncomingStorageState(storageState) {
  const encrypted = encrypt(JSON.stringify(storageState));
  db.prepare(
    `UPDATE turo_session SET storage_state_encrypted = ?, status = 'active', last_synced_at = NULL WHERE id = 1`
  ).run(encrypted);
}

export function getSavedStorageState() {
  const row = db.prepare(`SELECT * FROM turo_session WHERE id = 1`).get();
  if (!row || row.status !== "active" || !row.storage_state_encrypted) {
    return null;
  }
  return JSON.parse(decrypt(row.storage_state_encrypted));
}

export function markSessionExpired() {
  db.prepare(`UPDATE turo_session SET status = 'expired' WHERE id = 1`).run();
}

export function markSessionSynced() {
  db.prepare(
    `UPDATE turo_session SET last_synced_at = datetime('now') WHERE id = 1`
  ).run();
}

export function getSessionStatus() {
  const row = db.prepare(`SELECT status, last_synced_at FROM turo_session WHERE id = 1`).get();
  return row;
}
