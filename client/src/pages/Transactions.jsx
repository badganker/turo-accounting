import { useEffect, useState } from "react";
import { api } from "../api.js";
import { money } from "../format.js";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../categories.js";

const emptyForm = {
  type: "expense",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  category: "",
  vehicle: "",
  description: "",
};

export default function Transactions() {
  const [rows, setRows] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api
      .listTransactions(filterType ? { type: filterType } : {})
      .then(setRows)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [filterType]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.date) return;
    setSaving(true);
    setError(null);
    try {
      await api.createTransaction(form);
      setForm({ ...emptyForm, type: form.type });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    await api.deleteTransaction(id);
    load();
  };

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div>
      <h2>Transactions</h2>

      <div className="card">
        <h3>Add manual entry</h3>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Type
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value, category: "" })}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              Amount (USD)
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vehicle
              <input
                type="text"
                value={form.vehicle}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
              />
            </label>
            <label>
              Description
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add transaction"}
          </button>
        </form>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>All transactions</h3>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <p className="muted">No transactions yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Vehicle</th>
                <th>Description</th>
                <th>Source</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.type}</td>
                  <td>{r.category || "—"}</td>
                  <td>{r.vehicle || "—"}</td>
                  <td>
                    {r.description || "—"}
                    {r.receipt_path && (
                      <>
                        {" "}
                        <a href={r.receipt_path} target="_blank" rel="noreferrer">
                          receipt
                        </a>
                      </>
                    )}
                  </td>
                  <td>{r.source}</td>
                  <td className={`amount ${r.type}`}>{money(r.amount_cents)}</td>
                  <td>
                    <button className="secondary" onClick={() => remove(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
