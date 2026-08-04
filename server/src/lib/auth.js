import crypto from "node:crypto";

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

export function issueToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString(
    "base64url"
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function checkPassword(candidate) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error("APP_PASSWORD is not set in server/.env");
  }
  const a = Buffer.from(String(candidate || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}
