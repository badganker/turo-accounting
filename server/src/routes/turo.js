import { Router } from "express";
import { startInteractiveLogin, getLoginState, getSessionStatus } from "../turo/session.js";
import { syncTuroEarnings } from "../turo/sync.js";

const router = Router();

router.get("/status", (req, res) => {
  res.json({ session: getSessionStatus(), login: getLoginState() });
});

router.post("/connect", async (req, res) => {
  const state = await startInteractiveLogin();
  res.json(state);
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
