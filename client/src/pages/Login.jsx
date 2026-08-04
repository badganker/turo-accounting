import { useState } from "react";
import { api } from "../api.js";

export default function Login({ onLoggedIn }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.login(password);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form className="card" style={{ width: 280 }} onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Turo Accounting</h2>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          Password
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="error">{error}</div>}
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={loading || !password}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
