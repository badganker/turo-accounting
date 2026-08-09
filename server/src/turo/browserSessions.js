import crypto from "node:crypto";
import { chromium } from "playwright";
import { saveIncomingStorageState } from "./session.js";
import { ensureVirtualDisplay } from "./xvfb.js";

const LOGIN_URL = "https://turo.com/us/en/login";
const ABSOLUTE_TIMEOUT_MS = 10 * 60 * 1000;
const LOGIN_POLL_MS = 2000;
const SWEEP_INTERVAL_MS = 30 * 1000;
const MAX_CONCURRENT_SESSIONS = Number(process.env.MAX_CONCURRENT_TURO_SESSIONS) || 3;

// sessionId -> { userId, browser, context, page, cdp, createdAt, status,
//                onFrame, onConnected, loginTimer }
const sessions = new Map();

function isTuroHost(hostname) {
  return hostname === "turo.com" || hostname.endsWith(".turo.com");
}

async function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  clearInterval(session.loginTimer);
  await session.browser
    .close()
    .catch((err) => console.error(`[turo-connect] browser close error for ${sessionId}:`, err.message));
}

// Anyone abandoning a connect attempt without a clean WebSocket close
// (closed laptop lid, killed tab, etc.) would otherwise leak a Chromium
// process forever — this is the backstop.
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.createdAt > ABSOLUTE_TIMEOUT_MS) {
      destroySession(sessionId);
    }
  }
}, SWEEP_INTERVAL_MS).unref();

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

export async function createSession(userId) {
  // Replace-my-own-session first, then check capacity — otherwise a user
  // reconnecting (their most common action after the first time) gets
  // wrongly capacity-blocked by their own prior session still occupying a
  // slot, once the server is at the global cap.
  for (const [sessionId, session] of sessions) {
    if (session.userId === userId) await destroySession(sessionId);
  }

  if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
    const err = new Error("Too many people are connecting Turo accounts right now — try again in a minute.");
    err.code = "CAPACITY";
    throw err;
  }

  const sessionId = crypto.randomBytes(16).toString("hex");
  // headless:true gets flat-out blocked by Cloudflare on turo.com — see
  // xvfb.js. --no-sandbox is needed because the Docker image runs as root
  // (see Dockerfile/README known limitations).
  ensureVirtualDisplay();
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const session = {
    userId,
    browser,
    context,
    page,
    cdp: null,
    createdAt: Date.now(),
    status: "connecting",
    onFrame: null,
    onConnected: null,
    loginTimer: null,
  };
  sessions.set(sessionId, session);

  // Without this, the ephemeral browser is just a free anonymous
  // headless-browsing proxy for any site a user cares to click through to.
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    let hostname;
    try {
      hostname = new URL(frame.url()).hostname;
    } catch {
      return;
    }
    if (!isTuroHost(hostname)) {
      destroySession(sessionId);
    }
  });

  session.loginTimer = setInterval(async () => {
    if (!sessions.has(sessionId)) return;
    const loggedIn = await page
      .evaluate(() => {
        const text = document.body.innerText || "";
        return text.includes("Switch to host") || text.includes("Switch to guest");
      })
      .catch(() => false);
    if (!loggedIn) return;

    clearInterval(session.loginTimer);
    session.status = "connected";
    const storageState = await context.storageState();
    saveIncomingStorageState(userId, storageState);
    session.onConnected?.();
    setTimeout(() => destroySession(sessionId), 3000);
  }, LOGIN_POLL_MS);

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  } catch (err) {
    await destroySession(sessionId);
    throw err;
  }

  return sessionId;
}

export { destroySession };
