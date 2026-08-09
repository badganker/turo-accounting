import rateLimit from "express-rate-limit";

// Per-IP. These sit alongside (not instead of) the per-account/global
// concurrency caps in turo/browserSessions.js — those bound resource use
// once a session exists, these bound how fast someone can hit the
// endpoints that create state (accounts, browser sessions) in the first
// place.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts — try again in a few minutes." },
});

export const connectSessionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many Turo connect attempts from this network — try again later." },
});
