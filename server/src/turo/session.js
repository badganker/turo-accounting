import { chromium } from "playwright";
import { db } from "../db.js";
import { encrypt, decrypt } from "../lib/crypto.js";

// Turo has no public OAuth/API for hosts, and login always requires either an
// SMS code, an email flow, or Google/Apple sign-in — none of which can be
// driven unattended with a stored password. So instead we open a real,
// visible browser window, let the user log in exactly as they normally
// would, then capture and encrypt the resulting session (cookies/local
// storage) via Playwright's storageState. Sync later reuses that session
// without ever touching the user's credentials.

const LOGIN_URL = "https://turo.com/us/en/login";
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;

let loginState = { status: "idle", message: null }; // idle | waiting | success | error

export function getLoginState() {
  return loginState;
}

export async function startInteractiveLogin() {
  if (loginState.status === "waiting") {
    return loginState;
  }
  loginState = { status: "waiting", message: "Browser window opened — log in to Turo there." };

  (async () => {
    let browser;
    try {
      browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

      const deadline = Date.now() + LOGIN_TIMEOUT_MS;
      let loggedIn = false;
      while (Date.now() < deadline) {
        if (page.isClosed()) {
          throw new Error("Browser window was closed before login completed.");
        }
        loggedIn = await page
          .evaluate(() => {
            const text = document.body.innerText || "";
            return text.includes("Switch to host") || text.includes("Switch to guest");
          })
          .catch(() => false);
        if (loggedIn) break;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      if (!loggedIn) {
        throw new Error("Timed out waiting for login.");
      }

      const storageState = await context.storageState();
      const encrypted = encrypt(JSON.stringify(storageState));
      db.prepare(
        `UPDATE turo_session SET storage_state_encrypted = ?, status = 'active', last_synced_at = NULL WHERE id = 1`
      ).run(encrypted);

      loginState = { status: "success", message: "Turo session saved." };
      await browser.close();
    } catch (err) {
      loginState = { status: "error", message: err.message };
      if (browser) await browser.close().catch(() => {});
    }
  })();

  return loginState;
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
