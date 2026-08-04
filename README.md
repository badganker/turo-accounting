# Turo Accounting

Tracks income and expenses for a Turo hosting business: pulls trip earnings and
guest reimbursements straight from your Turo account, and lets you upload
receipts (fuel, cleaning, maintenance, tolls…) which Claude reads to fill in
the amount/date/category for you.

## Structure

- `server/` — Express API + SQLite (`server/data/app.sqlite`, created on first run)
- `client/` — React (Vite) frontend

## Setup

**1. Server**

```bash
cd server
npm install
npx playwright install chromium   # only needed once, powers the Turo login flow
cp .env.example .env
```

Edit `server/.env`:
- `ANTHROPIC_API_KEY` — needed for receipt reading. Get one at
  [console.anthropic.com](https://console.anthropic.com).
- `SESSION_ENCRYPTION_KEY` — already generated for you by setup; only
  regenerate if you want to invalidate a saved Turo session.

```bash
npm run dev
```

Runs on http://localhost:4100.

**2. Client** (separate terminal)

```bash
cd client
npm install
npm run dev
```

Runs on http://localhost:5174 and proxies `/api/*` + `/uploads/*` to the server.

## How the Turo connection works

Turo has no public API or OAuth for third-party apps, and login always
requires an SMS code, an email flow, or Google/Apple sign-in — none of which
can be driven unattended with a stored password. So:

1. **Turo Sync → Connect Turo account** opens a real, visible browser window
   on your machine. Log in there exactly as you normally would (phone code,
   Google, whatever). Nothing you type is seen or stored by this app.
2. Once logged in, the app saves that browser session (cookies), encrypted at
   rest with `SESSION_ENCRYPTION_KEY` — never your password.
3. **Sync now** reuses that saved session to fetch
   `https://turo.com/earnings/csv?year=YYYY` (the same CSV export Turo's own
   "Download CSV" button on the Transaction History page uses) for the
   current and previous year, and imports every row as an income or expense
   transaction (negative rows — cancellation fees, adjustments — are stored
   as expenses).
4. When the session eventually expires, `Sync now` will fail with a clear
   "session expired" error — just hit **Connect Turo account** again.

Turo's CSV export has ~47 columns and the exact header names weren't
available while building this (would've required downloading a real export
with live financial data into this session, which felt like the wrong call —
this was built by inspecting the page structure only). The importer
(`server/src/turo/sync.js`) matches columns by fuzzy header name (e.g. any
header containing "earnings" or "amount") rather than fixed position, and
keeps the full original row in `raw_data` for every imported transaction —
so if a column is misread, nothing is lost and the mapping in `sync.js` can
be adjusted without re-pulling data.

## Receipt upload

**Upload Receipt** page → pick a photo → Claude extracts vendor, amount,
date, and category → you review/edit before it's saved as an expense. The
original image is kept in `server/uploads/` and linked from the transaction.

## Categories

- Income: `trip_earning`, `reimbursement`, `extras`, `other_income`
- Expense: `fuel`, `cleaning`, `maintenance`, `insurance`, `toll`, `supplies`,
  `parking`, `fee`, `other_expense`

## Known limitations

- Single-user, no auth — this is meant to run locally on your own machine,
  not be exposed to the internet.
- `react-router-dom` and `vite`'s `esbuild` have moderate advisories with no
  fix available for Node 18 (the fixed major versions require Node 20+). Low
  risk for a localhost-only personal tool; upgrade Node and run
  `npm audit fix --force` in `client/` if you want to clear them.
- The Turo CSV column mapping (see above) is a best-effort guess, not
  verified against a real export — check the first sync's results against
  your actual Turo earnings page.
