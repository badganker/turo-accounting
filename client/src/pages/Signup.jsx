import { useState } from "react";
import { api } from "../api.js";

export default function Signup({ onSignedUp, onSwitchToLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.signup(email, password);
      onSignedUp();
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
      <form className="card" style={{ width: 300 }} onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Create your account</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            Email
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="muted">At least 8 characters</span>
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" disabled={loading || !email || password.length < 8}>
            {loading ? "Creating…" : "Create account"}
          </button>
          <button type="button" className="secondary" onClick={onSwitchToLogin}>
            I already have an account
          </button>
        </div>
      </form>
    </div>
  );
}
