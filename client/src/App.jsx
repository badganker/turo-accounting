import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Transactions from "./pages/Transactions.jsx";
import UploadReceipt from "./pages/UploadReceipt.jsx";
import TuroSync from "./pages/TuroSync.jsx";
import TuroConnect from "./pages/TuroConnect.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import { api, setUnauthorizedHandler } from "./api.js";

export default function App() {
  const [auth, setAuth] = useState(null); // null = checking, else { authenticated, email }
  const [authView, setAuthView] = useState("login"); // "login" | "signup"

  const checkAuth = () =>
    api
      .authStatus()
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false }));

  useEffect(() => {
    setUnauthorizedHandler(() => setAuth({ authenticated: false }));
    checkAuth();
  }, []);

  if (auth === null) return null;

  if (!auth.authenticated) {
    return authView === "signup" ? (
      <Signup onSignedUp={checkAuth} onSwitchToLogin={() => setAuthView("login")} />
    ) : (
      <Login onLoggedIn={checkAuth} onSwitchToSignup={() => setAuthView("signup")} />
    );
  }

  const logout = async () => {
    await api.logout();
    setAuth({ authenticated: false });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Turo Accounting</h1>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => (isActive ? "active" : "")}>
            Transactions
          </NavLink>
          <NavLink to="/upload-receipt" className={({ isActive }) => (isActive ? "active" : "")}>
            Upload Receipt
          </NavLink>
          <NavLink to="/turo-sync" className={({ isActive }) => (isActive ? "active" : "")}>
            Turo Sync
          </NavLink>
        </nav>
        <div style={{ marginTop: 24, fontSize: 12, color: "#888", wordBreak: "break-all" }}>
          {auth.email}
        </div>
        <button className="secondary" style={{ marginTop: 8 }} onClick={logout}>
          Log out
        </button>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/upload-receipt" element={<UploadReceipt />} />
          <Route path="/turo-sync" element={<TuroSync />} />
          <Route path="/turo-connect" element={<TuroConnect />} />
        </Routes>
      </main>
    </div>
  );
}
