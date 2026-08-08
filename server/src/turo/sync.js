import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import { db } from "../db.js";
import { turoGet } from "./http.js";
import { getSavedStorageState, markSessionExpired, markSessionSynced } from "./session.js";

// Turo's host "Transaction history" page exports a CSV per year at
// /earnings/csv?year=YYYY (confirmed from the real "Download CSV" link on
// https://turo.com/us/en/earnings). We don't have a captured sample of the
// full 47-column schema, so the mapper below matches columns by fuzzy header
// name instead of fixed position, and keeps the full raw row so nothing is
// lost if a guess is wrong — it just shows up uncategorized for the user to
// fix, rather than silently mis-filed.

function findColumn(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function parseMoney(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function guessCategory(type, description) {
  const text = `${type || ""} ${description || ""}`.toLowerCase();
  if (text.includes("reimburs")) return "reimbursement";
  if (text.includes("extra")) return "extras";
  if (text.includes("cancellation") || text.includes("penalt")) return "fee";
  if (text.includes("trip")) return "trip_earning";
  if (text.includes("toll")) return "toll";
  if (text.includes("cleaning")) return "cleaning";
  return "other";
}

async function fetchYearCsv(year, storageState) {
  const csvText = await turoGet(`/earnings/csv?year=${year}`, storageState);
  if (!csvText || !csvText.trim()) return [];
  let rows;
  try {
    rows = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true });
  } catch {
    return [];
  }
  return rows;
}

export async function syncTuroEarnings(userId, { years } = {}) {
  const storageState = getSavedStorageState(userId);
  if (!storageState) {
    const err = new Error("No saved Turo session. Connect your Turo account first.");
    err.code = "NO_SESSION";
    throw err;
  }

  const currentYear = new Date().getFullYear();
  const targetYears = years && years.length ? years : [currentYear, currentYear - 1];

  const insert = db.prepare(`
    INSERT INTO transactions
      (user_id, type, source, dedup_key, date, amount_cents, currency, category, vehicle, description, reservation_id, raw_data)
    VALUES (@user_id, @type, 'turo_sync', @dedup_key, @date, @amount_cents, 'USD', @category, @vehicle, @description, @reservation_id, @raw_data)
    ON CONFLICT(user_id, dedup_key) DO UPDATE SET
      amount_cents = excluded.amount_cents,
      category = excluded.category,
      updated_at = datetime('now')
  `);

  let imported = 0;
  let skipped = 0;

  try {
    for (const year of targetYears) {
      const rows = await fetchYearCsv(year, storageState);
      if (!rows.length) continue;
      const headers = Object.keys(rows[0]);

      const dateCol = findColumn(headers, ["date"]);
      const amountCol = findColumn(headers, [
        "host earnings",
        "earnings",
        "amount",
        "payout",
        "total",
      ]);
      const typeCol = findColumn(headers, ["type", "transaction"]);
      const descCol = findColumn(headers, ["description", "guest", "trip"]);
      const vehicleCol = findColumn(headers, ["vehicle", "car"]);
      const reservationCol = findColumn(headers, ["reservation", "trip id"]);

      for (const row of rows) {
        const amountCents = amountCol ? parseMoney(row[amountCol]) : null;
        if (amountCents == null) {
          skipped++;
          continue;
        }
        const date = dateCol ? row[dateCol] : null;
        const description = descCol ? row[descCol] : null;
        const reservationId = reservationCol ? row[reservationCol] : null;
        const rawJson = JSON.stringify(row);
        const dedupKey =
          reservationId && date && amountCol
            ? `turo:${year}:${reservationId}:${date}:${row[amountCol]}:${description ?? ""}`
            : `turo:${year}:${crypto.createHash("sha1").update(rawJson).digest("hex")}`;

        insert.run({
          user_id: userId,
          type: amountCents >= 0 ? "income" : "expense",
          dedup_key: dedupKey,
          date: date || `${year}-01-01`,
          amount_cents: Math.abs(amountCents),
          category: guessCategory(typeCol ? row[typeCol] : null, description),
          vehicle: vehicleCol ? row[vehicleCol] : null,
          description: description || (typeCol ? row[typeCol] : "Turo transaction"),
          reservation_id: reservationId,
          raw_data: rawJson,
        });
        imported++;
      }
    }
  } catch (err) {
    if (err.code === "SESSION_EXPIRED") {
      markSessionExpired(userId);
    }
    throw err;
  }

  markSessionSynced(userId);
  return { imported, skipped, years: targetYears };
}
