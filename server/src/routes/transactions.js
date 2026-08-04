import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const { type, category, from, to, q } = req.query;
  const clauses = [];
  const params = {};

  if (type) {
    clauses.push("type = @type");
    params.type = type;
  }
  if (category) {
    clauses.push("category = @category");
    params.category = category;
  }
  if (from) {
    clauses.push("date >= @from");
    params.from = from;
  }
  if (to) {
    clauses.push("date <= @to");
    params.to = to;
  }
  if (q) {
    clauses.push("(description LIKE @q OR vehicle LIKE @q)");
    params.q = `%${q}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC`)
    .all(params);
  res.json(rows);
});

router.post("/", (req, res) => {
  const { type, date, amount, currency, category, vehicle, description, reservation_id } =
    req.body;

  if (!type || !["income", "expense"].includes(type)) {
    return res.status(400).json({ error: "type must be 'income' or 'expense'" });
  }
  if (!date || amount == null) {
    return res.status(400).json({ error: "date and amount are required" });
  }

  const info = db
    .prepare(
      `INSERT INTO transactions (type, source, date, amount_cents, currency, category, vehicle, description, reservation_id)
       VALUES (@type, 'manual', @date, @amount_cents, @currency, @category, @vehicle, @description, @reservation_id)`
    )
    .run({
      type,
      date,
      amount_cents: Math.round(Number(amount) * 100),
      currency: currency || "USD",
      category: category || null,
      vehicle: vehicle || null,
      description: description || null,
      reservation_id: reservation_id || null,
    });

  const row = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put("/:id", (req, res) => {
  const existing = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { type, date, amount, currency, category, vehicle, description, reservation_id } =
    req.body;

  db.prepare(
    `UPDATE transactions SET
       type = @type, date = @date, amount_cents = @amount_cents, currency = @currency,
       category = @category, vehicle = @vehicle, description = @description,
       reservation_id = @reservation_id, updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id: req.params.id,
    type: type ?? existing.type,
    date: date ?? existing.date,
    amount_cents: amount != null ? Math.round(Number(amount) * 100) : existing.amount_cents,
    currency: currency ?? existing.currency,
    category: category ?? existing.category,
    vehicle: vehicle ?? existing.vehicle,
    description: description ?? existing.description,
    reservation_id: reservation_id ?? existing.reservation_id,
  });

  const row = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(req.params.id);
  res.json(row);
});

router.delete("/:id", (req, res) => {
  const info = db.prepare(`DELETE FROM transactions WHERE id = ?`).run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

export default router;
