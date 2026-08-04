import "dotenv/config";
import { runInteractiveLogin } from "../src/turo/interactiveLogin.js";

// Run this on your own machine (it opens a real browser window) to connect
// or reconnect a Turo session — whether the app itself is running locally
// or deployed elsewhere. Usage:
//
//   TURO_TARGET_URL=https://your-app.example.com npm run connect:turo
//
// Defaults to http://localhost:<PORT> (i.e. your local server) if
// TURO_TARGET_URL isn't set. Uses APP_PASSWORD from server/.env to log in.

const targetUrl = (process.env.TURO_TARGET_URL || `http://localhost:${process.env.PORT || 4100}`)
  .replace(/\/$/, "");
const password = process.env.APP_PASSWORD;

if (!password) {
  console.error("APP_PASSWORD is not set in server/.env — needed to authenticate to the app.");
  process.exit(1);
}

async function main() {
  console.log(`Logging in to ${targetUrl} ...`);
  const loginRes = await fetch(`${targetUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!loginRes.ok) {
    throw new Error(`App login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const setCookie = loginRes.headers.get("set-cookie");
  if (!setCookie) throw new Error("App login succeeded but no session cookie was returned.");
  const cookie = setCookie.split(";")[0];

  console.log("Opening a browser window — log in to Turo there (SMS code / email / Google / Apple, whatever you normally use)...");
  const storageState = await runInteractiveLogin({
    onWaiting: () => console.log("Waiting for you to finish logging in..."),
  });

  console.log("Login detected. Saving session...");
  const importRes = await fetch(`${targetUrl}/api/turo/session/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ storageState }),
  });
  if (!importRes.ok) {
    throw new Error(`Saving session failed: ${importRes.status} ${await importRes.text()}`);
  }

  console.log(`Done — ${targetUrl} can now sync your Turo earnings.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
