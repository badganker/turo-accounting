import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { extractReceipt } from "../lib/claudeVision.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

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

  const ext = path.extname(req.file.originalname) || ".jpg";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, req.file.buffer);

  try {
    const base64 = req.file.buffer.toString("base64");
    const draft = await extractReceipt(base64, req.file.mimetype);
    res.json({ receiptPath: `/uploads/${filename}`, draft });
  } catch (err) {
    res.status(502).json({
      error: `Receipt uploaded, but AI extraction failed: ${err.message}`,
      receiptPath: `/uploads/${filename}`,
    });
  }
});

router.post("/confirm", (req, res) => {
  const { receiptPath, vendor, amount, currency, date, category, description } = req.body;
  if (amount == null || !date) {
    return res.status(400).json({ error: "amount and date are required" });
  }

  const info = db
    .prepare(
      `INSERT INTO transactions (type, source, date, amount_cents, currency, category, vehicle, description, receipt_path)
       VALUES ('expense', 'receipt', @date, @amount_cents, @currency, @category, NULL, @description, @receipt_path)`
    )
    .run({
      date,
      amount_cents: Math.round(Number(amount) * 100),
      currency: currency || "USD",
      category: category || "other_expense",
      description: description || vendor || "Receipt expense",
      receipt_path: receiptPath || null,
    });

  const row = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

export default router;
