import { Router } from "express";
import { getSessionStatus, saveIncomingStorageState } from "../turo/session.js";
import { syncTuroEarnings } from "../turo/sync.js";

const router = Router();

router.get("/status", (req, res) => {
  res.json({ session: getSessionStatus() });
});

// Called by server/scripts/connect-turo.js after an interactive login
// completes locally (see that script for why the login itself can't happen
// on a headless deployed server).
router.post("/session/import", (req, res) => {
  const { storageState } = req.body || {};
  if (!storageState || !Array.isArray(storageState.cookies)) {
    return res.status(400).json({ error: "storageState with cookies is required" });
  }
  saveIncomingStorageState(storageState);
  res.json({ ok: true });
});

router.post("/sync", async (req, res) => {
  try {
    const result = await syncTuroEarnings({ years: req.body?.years });
    res.json(result);
  } catch (err) {
    const status = err.code === "NO_SESSION" || err.code === "SESSION_EXPIRED" ? 409 : 500;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

export default router;
