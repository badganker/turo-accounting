import "dotenv/config";
import readline from "node:readline/promises";
import { runInteractiveLogin } from "../src/turo/interactiveLogin.js";

// Run this on your own machine (it opens a real browser window) to connect
// or reconnect your Turo session — whether the app itself is running
// locally or deployed elsewhere. Usage:
//
//   TURO_TARGET_URL=https://your-app.example.com npm run connect:turo
//
// Defaults to http://localhost:<PORT> (i.e. your local server) if
// TURO_TARGET_URL isn't set. Logs into the app with your own account
// (ACCOUNT_EMAIL / ACCOUNT_PASSWORD env vars, or prompts if not set) — this
// is your app account, not your Turo password.

const targetUrl = (process.env.TURO_TARGET_URL || `http://localhost:${process.env.PORT || 4100}`)
  .replace(/\/$/, "");

async function promptFor(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

async function main() {
  const email = process.env.ACCOUNT_EMAIL || (await promptFor("Account email: "));
  const password = process.env.ACCOUNT_PASSWORD || (await promptFor("Account password: "));

  console.log(`Logging in to ${targetUrl} ...`);
  const loginRes = await fetch(`${targetUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
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
