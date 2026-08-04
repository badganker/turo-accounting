import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function TuroSync() {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);

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
        <p>
          Turo doesn't offer third-party account login (no OAuth, and sign-in always requires an
          SMS code, email flow, or Google/Apple), and it needs a real browser window to complete
          — so connecting has to happen on a machine with a display, not here.
        </p>
        <p>
          On your Mac, in the <code>server/</code> folder, run:
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
          A browser window opens — log in to Turo there exactly as you normally would. This app
          never sees your password, only the resulting session. Set{" "}
          <code>TURO_TARGET_URL</code> first if this app is deployed elsewhere, e.g.:
        </p>
        <pre
          style={{
            background: "#f4f4f4",
            padding: "10px 14px",
            borderRadius: 6,
            overflowX: "auto",
          }}
        >
          TURO_TARGET_URL=https://your-app.example.com npm run connect:turo
        </pre>
        <p className="muted">
          Once connected, <strong>Sync now</strong> below works from anywhere — including here on
          your phone — until the session eventually expires, at which point you run the command
          again.
        </p>
      </div>

      <div className="card">
        <h3>
          Session status: <span className={`badge ${sessionStatus}`}>{sessionStatus}</span>
        </h3>
        {status?.session?.last_synced_at && (
          <p className="muted">Last synced: {status.session.last_synced_at}</p>
        )}
        <button onClick={sync} disabled={syncing || sessionStatus === "none"}>
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
    </div>
  );
}
