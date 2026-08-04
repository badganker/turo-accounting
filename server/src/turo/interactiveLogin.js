import { chromium } from "playwright";

const LOGIN_URL = "https://turo.com/us/en/login";
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;

// Opens a real, visible browser window and waits for the user to log in to
// Turo by hand (SMS code / email / Google / Apple — whatever they normally
// use). Returns the resulting Playwright storageState (cookies + local
// storage) once logged in. Meant to run on a machine with a display —
// see server/scripts/connect-turo.js.
export async function runInteractiveLogin({ onWaiting } = {}) {
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    onWaiting?.();

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    let loggedIn = false;
    while (Date.now() < deadline) {
      if (page.isClosed()) {
        throw new Error("Browser window was closed before login completed.");
      }
      loggedIn = await page
        .evaluate(() => {
          const text = document.body.innerText || "";
          return text.includes("Switch to host") || text.includes("Switch to guest");
        })
        .catch(() => false);
      if (loggedIn) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    if (!loggedIn) {
      throw new Error("Timed out waiting for login.");
    }

    return await context.storageState();
  } finally {
    await browser.close().catch(() => {});
  }
}
