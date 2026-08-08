import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { extractReceipt } from "../lib/claudeVision.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsRoot = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "uploads")
  : path.join(__dirname, "..", "..", "uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are supported."));
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/upload", upload.single("receipt"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded (field 'receipt')." });

  const userDir = path.join(uploadsRoot, String(req.userId));
  fs.mkdirSync(userDir, { recursive: true });

  const ext = path.extname(req.file.originalname) || ".jpg";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(userDir, filename), req.file.buffer);
  const receiptPath = `/uploads/${req.userId}/${filename}`;

  try {
    const base64 = req.file.buffer.toString("base64");
    const draft = await extractReceipt(base64, req.file.mimetype);
    res.json({ receiptPath, draft });
  } catch (err) {
    res.status(502).json({
      error: `Receipt uploaded, but AI extraction failed: ${err.message}`,
      receiptPath,
    });
  }
});

router.post("/confirm", (req, res) => {
  const { receiptPath, vendor, amount, currency, date, category, description } = req.body;
  if (amount == null || !date) {
    return res.status(400).json({ error: "amount and date are required" });
  }
  if (receiptPath && !receiptPath.startsWith(`/uploads/${req.userId}/`)) {
    return res.status(403).json({ error: "receiptPath does not belong to this account" });
  }

  const info = db
    .prepare(
      `INSERT INTO transactions (user_id, type, source, date, amount_cents, currency, category, vehicle, description, receipt_path)
       VALUES (@user_id, 'expense', 'receipt', @date, @amount_cents, @currency, @category, NULL, @description, @receipt_path)`
    )
    .run({
      user_id: req.userId,
      date,
      amount_cents: Math.round(Number(amount) * 100),
      currency: currency || "USD",
      category: category || "other_expense",
      description: description || vendor || "Receipt expense",
      receipt_path: receiptPath || null,
    });

  const row = db
    .prepare(`SELECT * FROM transactions WHERE id = ? AND user_id = ?`)
    .get(info.lastInsertRowid, req.userId);
  res.status(201).json(row);
});

export default router;
