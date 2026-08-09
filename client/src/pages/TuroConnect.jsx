import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const WIDTH = 1024;
const HEIGHT = 768;
const RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 4;

function wsUrl(sessionId) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/turo-connect?sessionId=${sessionId}`;
}

export default function TuroConnect() {
  const canvasRef = useRef(null);
  const keyboardInputRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const [status, setStatus] = useState("starting"); // starting | streaming | connected | reconnecting | error
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer = null;

    const connect = async () => {
      try {
        const res = await fetch("/api/turo/connect-session", { method: "POST" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not start a connect session");
        if (cancelled) return;

        const ws = new WebSocket(wsUrl(body.sessionId));
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "frame") {
            setStatus((s) => (s === "connected" ? s : "streaming"));
            const img = new Image();
            img.onload = () => {
              const ctx = canvasRef.current?.getContext("2d");
              ctx?.drawImage(img, 0, 0, WIDTH, HEIGHT);
            };
            img.src = `data:image/jpeg;base64,${msg.data}`;
          } else if (msg.type === "connected") {
            setStatus("connected");
            setTimeout(() => navigate("/turo-sync"), 1500);
          } else if (msg.type === "error") {
            setStatus("error");
            setError(msg.message);
          }
        };

        ws.onclose = () => {
          if (cancelled || status === "connected") return;
          // A dropped connection mid-login is usually transient (network
          // hiccup, phone screen lock) — worth a few silent retries before
          // making the user start over and lose their place in the Turo
          // login flow. Starting a new connect-session also gets a fresh
          // browser, since the old one's WS (and so its session) is gone.
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current += 1;
            setStatus("reconnecting");
            reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
          } else {
            setStatus("error");
          }
        };
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err.message);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const canvasPointFromClient = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const sendMouse = (kind, point, modifiers = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "mouse",
        kind,
        x: point.x,
        y: point.y,
        button: "left",
        shiftKey: !!modifiers.shiftKey,
        ctrlKey: !!modifiers.ctrlKey,
        altKey: !!modifiers.altKey,
        metaKey: !!modifiers.metaKey,
      })
    );
  };

  const onMouseDown = (e) => sendMouse("mousePressed", canvasPointFromClient(e.clientX, e.clientY), e);
  const onMouseUp = (e) => sendMouse("mouseReleased", canvasPointFromClient(e.clientX, e.clientY), e);
  const onMouseMove = (e) => sendMouse("mouseMoved", canvasPointFromClient(e.clientX, e.clientY), e);

  // Canvas can't natively receive touch-typed input or summon a phone's
  // on-screen keyboard, so a normally-invisible text input sits behind it
  // purely to grab focus and forward key events — same trick web-based
  // remote-desktop clients use.
  const onTouchStart = (e) => {
    e.preventDefault();
    keyboardInputRef.current?.focus();
    const t = e.touches[0];
    sendMouse("mousePressed", canvasPointFromClient(t.clientX, t.clientY));
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) sendMouse("mouseMoved", canvasPointFromClient(t.clientX, t.clientY));
  };
  const onTouchEnd = (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (t) sendMouse("mouseReleased", canvasPointFromClient(t.clientX, t.clientY));
  };

  const sendKey = (kind, e) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    e.preventDefault();
    ws.send(
      JSON.stringify({
        type: "key",
        kind,
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        text: kind === "keyDown" && e.key.length === 1 ? e.key : undefined,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      })
    );
  };

  const statusMessage = {
    starting: "Starting a browser session…",
    reconnecting: "Connection dropped — reconnecting…",
  }[status];

  return (
    <div>
      <h2>Connect Turo</h2>
      <p className="muted">
        Log in to Turo below exactly as you normally would. This runs in an isolated browser
        session on the server — nothing you type here is stored except the resulting login
        session, once you're in.
      </p>

      {status === "error" && (
        <div className="card">
          <div className="error">{error || "Connection lost before login completed."}</div>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      )}

      {status === "connected" && (
        <div className="card">
          <p>Connected! Redirecting to Turo Sync…</p>
        </div>
      )}

      {(status === "starting" || status === "streaming" || status === "reconnecting") && (
        <div className="card" style={{ display: "inline-block", padding: 8, position: "relative" }}>
          {statusMessage && <p className="muted">{statusMessage}</p>}
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            tabIndex={0}
            style={{ width: "100%", maxWidth: 640, display: "block", cursor: "default", outline: "none", touchAction: "none" }}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onKeyDown={(e) => sendKey("keyDown", e)}
            onKeyUp={(e) => sendKey("keyUp", e)}
          />
          {/* Invisible but focusable — see onTouchStart above */}
          <input
            ref={keyboardInputRef}
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            style={{ position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0 }}
            onKeyDown={(e) => sendKey("keyDown", e)}
            onKeyUp={(e) => sendKey("keyUp", e)}
          />
        </div>
      )}
    </div>
  );
}
