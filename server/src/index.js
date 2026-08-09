import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "./db.js";

import authRouter from "./routes/auth.js";
import transactionsRouter from "./routes/transactions.js";
import receiptsRouter from "./routes/receipts.js";
import turoRouter from "./routes/turo.js";
import summaryRouter from "./routes/summary.js";
import { requireAuth } from "./lib/auth.js";
import { attachTuroConnectSocket } from "./turo/browserSocket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(cookieParser());
const uploadsDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "uploads")
  : path.join(__dirname, "..", "uploads");
// Not a blanket express.static — receipts are personal, so every request
// must prove it belongs to the requesting user, not just be authenticated.
app.get("/uploads/:userId/:filename", requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename); // strip any path traversal
  if (Number(req.params.userId) !== req.userId || !/^[\w.-]+$/.test(filename)) {
    return res.status(403).end();
  }
  res.sendFile(path.join(uploadsDir, String(req.userId), filename), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

app.use("/api/auth", authRouter);
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api", requireAuth);
app.use("/api/transactions", transactionsRouter);
app.use("/api/receipts", receiptsRouter);
app.use("/api/turo", turoRouter);
app.use("/api/summary", summaryRouter);

// In production this server also hosts the built client (single deployable
// process) — `npm run build` in client/ produces client/dist.
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const server = http.createServer(app);
attachTuroConnectSocket(server);

const port = process.env.PORT || 4100;
server.listen(port, () => {
  console.log(`Turo accounting server running on http://localhost:${port}`);
});
