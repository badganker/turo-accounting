import { useEffect, useState } from "react";
import { api } from "../api.js";

function money(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.summary().then(setSummary).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!summary) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h2>Dashboard</h2>

      <div className="stat-row">
        <div className="stat income">
          <div className="label">Income</div>
          <div className="value">{money(summary.income_cents)}</div>
        </div>
        <div className="stat expense">
          <div className="label">Expenses</div>
          <div className="value">{money(summary.expense_cents)}</div>
        </div>
        <div className="stat">
          <div className="label">Net</div>
          <div className="value">{money(summary.net_cents)}</div>
        </div>
      </div>

      <div className="card">
        <h3>By category</h3>
        {summary.byCategory.length === 0 ? (
          <p className="muted">No transactions yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Count</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCategory.map((row) => (
                <tr key={`${row.type}-${row.category}`}>
                  <td>{row.type}</td>
                  <td>{row.category || "uncategorized"}</td>
                  <td>{row.count}</td>
                  <td className={`amount ${row.type}`}>{money(row.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {summary.byVehicle.length > 0 && (
        <div className="card">
          <h3>By vehicle</h3>
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.byVehicle.map((row) => (
                <tr key={`${row.vehicle}-${row.type}`}>
                  <td>{row.vehicle}</td>
                  <td>{row.type}</td>
                  <td className={`amount ${row.type}`}>{money(row.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
