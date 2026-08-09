import { Router } from "express";
import { getSessionStatus, saveIncomingStorageState } from "../turo/session.js";
import { syncTuroEarnings } from "../turo/sync.js";
import { createSession } from "../turo/browserSessions.js";
import { connectSessionLimiter } from "../lib/rateLimit.js";

const router = Router();

router.get("/status", (req, res) => {
  res.json({ session: getSessionStatus(req.userId) });
});

// Starts an isolated headless-browser session the user completes their Turo
// login in — see server/src/turo/browserSessions.js + browserSocket.js for
// the screen-streaming/input-forwarding side of this.
router.post("/connect-session", connectSessionLimiter, async (req, res) => {
  try {
    const sessionId = await createSession(req.userId);
    res.json({ sessionId });
  } catch (err) {
    const status = err.code === "CAPACITY" ? 429 : 500;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

// Called by server/scripts/connect-turo.js after an interactive login
// completes locally (see that script for why the login itself can't happen
// on a headless deployed server).
router.post("/session/import", (req, res) => {
  const { storageState } = req.body || {};
  if (!storageState || !Array.isArray(storageState.cookies)) {
    return res.status(400).json({ error: "storageState with cookies is required" });
  }
  saveIncomingStorageState(req.userId, storageState);
  res.json({ ok: true });
});

router.post("/sync", async (req, res) => {
  try {
    const result = await syncTuroEarnings(req.userId, { years: req.body?.years });
    res.json(result);
  } catch (err) {
    const status = err.code === "NO_SESSION" || err.code === "SESSION_EXPIRED" ? 409 : 500;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

export default router;
