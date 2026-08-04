import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function TuroSync() {
  const [status, setStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const load = () => api.turoStatus().then(setStatus).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, []);

  const connect = async () => {
    setError(null);
    setConnecting(true);
    await api.turoConnect();
    pollRef.current = setInterval(async () => {
      const s = await api.turoStatus();
      setStatus(s);
      if (s.login.status !== "waiting") {
        clearInterval(pollRef.current);
        setConnecting(false);
      }
    }, 2000);
  };

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
          SMS code, email flow, or Google/Apple) — so this can't fully automate itself end to end.
          Instead: click <strong>Connect Turo account</strong> once, a real browser window opens,
          log in there exactly as you normally would, and this app saves that session (not your
          password). <strong>Sync now</strong> then pulls your latest earnings/reimbursements
          without asking you to log in again, until the session eventually expires — at which
          point you just reconnect the same way.
        </p>
      </div>

      <div className="card">
        <h3>
          Session status: <span className={`badge ${sessionStatus}`}>{sessionStatus}</span>
        </h3>
        {status?.session?.last_synced_at && (
          <p className="muted">Last synced: {status.session.last_synced_at}</p>
        )}
        <button onClick={connect} disabled={connecting}>
          {connecting ? "Waiting for login in the opened window…" : "Connect Turo account"}
        </button>{" "}
        <button
          className="secondary"
          onClick={sync}
          disabled={syncing || sessionStatus === "none"}
        >
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
