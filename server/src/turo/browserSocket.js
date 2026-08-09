import { WebSocketServer } from "ws";
import { verifyToken, SESSION_COOKIE } from "../lib/auth.js";
import { getSession, destroySession } from "./browserSessions.js";

const UPGRADE_PATH = "/ws/turo-connect";

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function modifierBitmask({ altKey, ctrlKey, metaKey, shiftKey }) {
  return (altKey ? 1 : 0) | (ctrlKey ? 2 : 0) | (metaKey ? 4 : 0) | (shiftKey ? 8 : 0);
}

async function handleMouse(cdp, msg) {
  await cdp
    .send("Input.dispatchMouseEvent", {
      type: msg.kind,
      x: msg.x,
      y: msg.y,
      button: msg.button || "left",
      clickCount: msg.kind === "mouseMoved" ? 0 : 1,
      modifiers: modifierBitmask(msg),
    })
    .catch(() => {});
}

async function handleKey(cdp, msg) {
  const params = {
    type: msg.kind,
    key: msg.key,
    code: msg.code,
    windowsVirtualKeyCode: msg.keyCode,
    modifiers: modifierBitmask(msg),
  };
  if (msg.kind === "char" && msg.text) params.text = msg.text;
  await cdp.send("Input.dispatchKeyEvent", params).catch(() => {});
}

export function attachTuroConnectSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== UPGRADE_PATH) return; // let other upgrade handlers (if any) deal with it

    const cookies = parseCookies(req.headers.cookie);
    const claims = verifyToken(cookies[SESSION_COOKIE]);
    const sessionId = url.searchParams.get("sessionId");
    const session = sessionId && getSession(sessionId);

    if (!claims || !session || session.userId !== claims.userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { sessionId, session });
    });
  });

  wss.on("connection", async (ws, req, { sessionId, session }) => {
    console.log(`[turo-connect] ws connected for ${sessionId}`);
    try {
      session.cdp = await session.context.newCDPSession(session.page);
      await session.cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 60,
        maxWidth: 1024,
        maxHeight: 768,
      });

      session.cdp.on("Page.screencastFrame", async ({ data, sessionId: cdpFrameId }) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: "frame", data }));
        }
        await session.cdp.send("Page.screencastFrameAck", { sessionId: cdpFrameId }).catch(() => {});
      });
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: err.message }));
      ws.close();
      return;
    }

    session.onConnected = () => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "connected" }));
      }
    };

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!session.cdp) return;
      if (msg.type === "mouse") await handleMouse(session.cdp, msg);
      else if (msg.type === "key") await handleKey(session.cdp, msg);
    });

    ws.on("close", () => {
      destroySession(sessionId);
    });
  });
}
