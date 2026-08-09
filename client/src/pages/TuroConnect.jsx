import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const WIDTH = 1024;
const HEIGHT = 768;

function wsUrl(sessionId) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/turo-connect?sessionId=${sessionId}`;
}

export default function TuroConnect() {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | streaming | connected | error
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/turo/connect-session", { method: "POST" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not start a connect session");
        if (cancelled) return;

        const ws = new WebSocket(wsUrl(body.sessionId));
        wsRef.current = ws;

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "frame") {
            setStatus((s) => (s === "starting" ? "streaming" : s));
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
          setStatus((s) => (s === "connected" ? s : "error"));
        };
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err.message);
        }
      }
    })();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [navigate]);

  const canvasPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const sendMouse = (kind, e) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const { x, y } = canvasPoint(e);
    ws.send(
      JSON.stringify({
        type: "mouse",
        kind,
        x,
        y,
        button: "left",
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      })
    );
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

      {(status === "starting" || status === "streaming") && (
        <div className="card" style={{ display: "inline-block", padding: 8 }}>
          {status === "starting" && <p className="muted">Starting a browser session…</p>}
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            tabIndex={0}
            style={{ width: "100%", maxWidth: 640, display: "block", cursor: "default", outline: "none" }}
            onMouseDown={(e) => sendMouse("mousePressed", e)}
            onMouseUp={(e) => sendMouse("mouseReleased", e)}
            onMouseMove={(e) => sendMouse("mouseMoved", e)}
            onKeyDown={(e) => sendKey("keyDown", e)}
            onKeyUp={(e) => sendKey("keyUp", e)}
          />
        </div>
      )}
    </div>
  );
}
