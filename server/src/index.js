import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./db.js";

import transactionsRouter from "./routes/transactions.js";
import receiptsRouter from "./routes/receipts.js";
import turoRouter from "./routes/turo.js";
import summaryRouter from "./routes/summary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/transactions", transactionsRouter);
app.use("/api/receipts", receiptsRouter);
app.use("/api/turo", turoRouter);
app.use("/api/summary", summaryRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4100;
app.listen(port, () => {
  console.log(`Turo accounting server running on http://localhost:${port}`);
});
