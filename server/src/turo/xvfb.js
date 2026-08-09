import { spawn } from "node:child_process";
import os from "node:os";

let started = false;

// Cloudflare (which fronts turo.com) blocks Chromium's real headless mode
// outright — confirmed by a live probe: identical request, headless:true got
// "Sorry, you've been blocked", headless:false loaded the page normally. So
// the connect-session browser has to run headed. On Linux (the Docker
// deployment) that needs a virtual display, since there's no real one;
// on macOS/Windows dev machines headed mode already works natively and this
// is a no-op.
export function ensureVirtualDisplay() {
  if (started || os.platform() !== "linux" || process.env.DISPLAY) {
    return;
  }
  started = true;
  process.env.DISPLAY = ":99";
  const xvfb = spawn("Xvfb", [":99", "-screen", "0", "1280x1024x24", "-nolisten", "tcp"], {
    stdio: "ignore",
  });
  xvfb.on("error", (err) => {
    console.error(
      `Failed to start Xvfb (needed for headed Chromium on Linux — see server/src/turo/xvfb.js): ${err.message}`
    );
  });
  xvfb.unref();
}
