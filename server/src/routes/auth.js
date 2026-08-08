import { Router } from "express";
import { db } from "../db.js";
import { hashPassword, verifyPassword, issueToken, verifyToken, SESSION_COOKIE } from "../lib/auth.js";

const router = Router();
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setSessionCookie(res, userId) {
  res.cookie(SESSION_COOKIE, issueToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

router.post("/signup", async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const passwordHash = await hashPassword(password);
  const info = db
    .prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?)`)
    .run(normalizedEmail, passwordHash);

  db.prepare(`INSERT INTO turo_session (user_id, status) VALUES (?, 'none')`).run(
    info.lastInsertRowid
  );

  setSessionCookie(res, info.lastInsertRowid);
  res.status(201).json({ ok: true });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(normalizedEmail);
  if (!user || !(await verifyPassword(password || "", user.password_hash))) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }

  setSessionCookie(res, user.id);
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get("/status", (req, res) => {
  const claims = verifyToken(req.cookies?.[SESSION_COOKIE]);
  if (!claims) return res.json({ authenticated: false });

  const user = db.prepare(`SELECT id, email FROM users WHERE id = ?`).get(claims.userId);
  if (!user) return res.json({ authenticated: false });

  res.json({ authenticated: true, email: user.email });
});

export default router;
