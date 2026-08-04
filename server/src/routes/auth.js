import { Router } from "express";
import { checkPassword, issueToken, verifyToken, SESSION_COOKIE } from "../lib/auth.js";

const router = Router();
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  if (!checkPassword(password)) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  res.cookie(SESSION_COOKIE, issueToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_MS,
  });
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get("/status", (req, res) => {
  res.json({ authenticated: verifyToken(req.cookies?.[SESSION_COOKIE]) });
});

export default router;
