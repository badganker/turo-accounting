import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function TuroSync() {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = () => api.turoStatus().then(setStatus).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const result = await api.turoSync();
      setSyncResult(result);
      load();
    } catch (err) {
      setError(err.message);
      load();
    } finally {
      setSyncing(false);
    }
  };

  const sessionStatus = status?.session?.status || "none";

  return (
    <div>
      <h2>Turo Sync</h2>

      <div className="card">
        <h3>
          Session status: <span className={`badge ${sessionStatus}`}>{sessionStatus}</span>
        </h3>
        {status?.session?.last_synced_at && (
          <p className="muted">Last synced: {status.session.last_synced_at}</p>
        )}
        <button onClick={() => navigate("/turo-connect")}>
          {sessionStatus === "active" ? "Reconnect Turo" : "Connect Turo"}
        </button>{" "}
        <button className="secondary" onClick={sync} disabled={syncing || sessionStatus === "none"}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        {error && <div className="error">{error}</div>}
        {syncResult && (
          <p className="muted">
            Imported {syncResult.imported} transactions from {syncResult.years?.join(", ")}
            {syncResult.skipped ? ` (${syncResult.skipped} rows skipped — unrecognized amount column)` : ""}.
          </p>
        )}
      </div>

      <div className="card">
        <p className="muted">
          <strong>Connect Turo</strong> logs you into Turo right here, in an isolated browser
          session on the server — nothing to install. Once connected, <strong>Sync now</strong>{" "}
          works from anywhere (including your phone) until the session eventually expires, at
          which point you just connect again.
        </p>
        <p className="muted">
          Prefer the command line instead? From the <code>server/</code> folder:
        </p>
        <pre
          style={{
            background: "#f4f4f4",
            padding: "10px 14px",
            borderRadius: 6,
            overflowX: "auto",
          }}
        >
          npm run connect:turo
        </pre>
        <p className="muted">
          It'll ask for your account email/password (the one you log into this app with, not
          Turo), then opens a real browser window for the Turo login. Set{" "}
          <code>TURO_TARGET_URL=https://your-app.example.com</code> first if connecting a
          deployed instance from your own machine.
        </p>
      </div>
    </div>
  );
}
