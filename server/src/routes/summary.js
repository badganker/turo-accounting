import { Router } from "express";
import { db } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const { from, to } = req.query;
  const clauses = [];
  const params = {};
  if (from) {
    clauses.push("date >= @from");
    params.from = from;
  }
  if (to) {
    clauses.push("date <= @to");
    params.to = to;
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const totals = db
    .prepare(
      `SELECT type, SUM(amount_cents) as total_cents, COUNT(*) as count
       FROM transactions ${where} GROUP BY type`
    )
    .all(params);

  const byCategory = db
    .prepare(
      `SELECT type, category, SUM(amount_cents) as total_cents, COUNT(*) as count
       FROM transactions ${where} GROUP BY type, category ORDER BY total_cents DESC`
    )
    .all(params);

  const byMonth = db
    .prepare(
      `SELECT substr(date, 1, 7) as month, type, SUM(amount_cents) as total_cents
       FROM transactions ${where} GROUP BY month, type ORDER BY month`
    )
    .all(params);

  const vehicleWhere = [...clauses, "vehicle IS NOT NULL"].join(" AND ");
  const byVehicle = db
    .prepare(
      `SELECT vehicle, type, SUM(amount_cents) as total_cents
       FROM transactions WHERE ${vehicleWhere} GROUP BY vehicle, type ORDER BY total_cents DESC`
    )
    .all(params);

  const income = totals.find((t) => t.type === "income")?.total_cents || 0;
  const expense = totals.find((t) => t.type === "expense")?.total_cents || 0;

  res.json({
    income_cents: income,
    expense_cents: expense,
    net_cents: income - expense,
    byCategory,
    byMonth,
    byVehicle,
  });
});

export default router;
