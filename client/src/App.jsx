import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Transactions from "./pages/Transactions.jsx";
import UploadReceipt from "./pages/UploadReceipt.jsx";
import TuroSync from "./pages/TuroSync.jsx";

export default function App() {
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
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/upload-receipt" element={<UploadReceipt />} />
          <Route path="/turo-sync" element={<TuroSync />} />
        </Routes>
      </main>
    </div>
  );
}
