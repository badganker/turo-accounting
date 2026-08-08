import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = "turo_acct_session";

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\" and add it to server/.env"
    );
  }
  return secret;
}

function sign(data) {
  return crypto.createHmac("sha256", getAuthSecret()).update(data).digest("base64url");
}

export function issueToken(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + TOKEN_TTL_MS })).toString(
    "base64url"
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const { userId, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof exp !== "number" || exp <= Date.now() || !userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req, res, next) {
  const claims = verifyToken(req.cookies?.[SESSION_COOKIE]);
  if (!claims) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.userId = claims.userId;
  next();
}
