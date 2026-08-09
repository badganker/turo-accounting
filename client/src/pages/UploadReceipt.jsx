import { useState } from "react";
import { api } from "../api.js";
import { RECEIPT_EXPENSE_CATEGORIES } from "../categories.js";

export default function UploadReceipt() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [receiptPath, setReceiptPath] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const onFile = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setDraft(null);
    setSaved(false);
    setError(null);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadReceipt(file);
      setReceiptPath(result.receiptPath);
      if (result.draft) {
        setDraft(result.draft);
      } else {
        setError(result.error || "AI extraction failed — enter details manually below.");
        setDraft({ vendor: "", amount: "", currency: "USD", date: "", category: "other_expense", description: "" });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const confirm = async () => {
    try {
      await api.confirmReceipt({ ...draft, receiptPath });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Upload Receipt</h2>
      <div className="card">
        <input type="file" accept="image/*" onChange={onFile} />
        {preview && <img className="receipt-preview" src={preview} alt="receipt preview" />}
        <div>
          <button onClick={upload} disabled={!file || uploading}>
            {uploading ? "Reading receipt…" : "Upload & extract"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {draft && !saved && (
        <div className="card">
          <h3>Review before saving</h3>
          <p className="muted">
            AI-extracted — check the amount, date, and category before saving as an expense.
          </p>
          <div className="form-grid">
            <label>
              Vendor
              <input
                value={draft.vendor || ""}
                onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
              />
            </label>
            <label>
              Amount (USD)
              <input
                type="number"
                step="0.01"
                value={draft.amount ?? ""}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={draft.date || ""}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label>
              Category
              <select
                value={draft.category || "other_expense"}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              >
                {RECEIPT_EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <input
                value={draft.description || ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
          </div>
          <button onClick={confirm} disabled={!draft.amount || !draft.date}>
            Save as expense
          </button>
        </div>
      )}

      {saved && (
        <div className="card">
          <p>Saved. See it under <a href="/transactions">Transactions</a>.</p>
        </div>
      )}
    </div>
  );
}
