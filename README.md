# Turo Accounting

Tracks income and expenses for a Turo hosting business: pulls trip earnings and
guest reimbursements straight from your Turo account, and lets you upload
receipts (fuel, cleaning, maintenance, tolls…) which Claude reads to fill in
the amount/date/category for you. Deployable so it's usable from your phone,
not just at home.

## Structure

- `server/` — Express API + SQLite (also serves the built client in production)
- `client/` — React (Vite) frontend
- `Dockerfile`, `fly.toml` — deployment (see "Deploying" below)

## Local setup

**1. Server**

```bash
cd server
npm install
npx playwright install chromium   # only needed once, powers the local Turo login script
cp .env.example .env
```

Edit `server/.env` and fill in:
- `ANTHROPIC_API_KEY` — needed for receipt reading. Get one at
  [console.anthropic.com](https://console.anthropic.com).
- `APP_PASSWORD` — the password you'll use to log into the app. Pick
  something strong once you're deploying this outside your own machine.
- `SESSION_ENCRYPTION_KEY` and `AUTH_SECRET` — already generated for you.

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

## Logging in

The app is gated by a single password (`APP_PASSWORD` in `server/.env`) —
there's no per-user accounts, this is meant for one person. The session
cookie lasts 30 days.

## How the Turo connection works

Turo has no public API or OAuth for third-party apps, and login always
requires an SMS code, an email flow, or Google/Apple sign-in — none of which
can be driven unattended with a stored password, and a deployed server
usually has no display to show a browser window on anyway. So connecting
always happens **locally, on a machine with a display** (your Mac), even if
the app itself is deployed elsewhere:

```bash
cd server
npm run connect:turo
```

This opens a real, visible browser window — log in to Turo there exactly as
you normally would (phone code, Google, whatever). Nothing you type is seen
by this app; only the resulting browser session is captured, encrypted, and
sent to wherever the app is running. By default that's your local server; to
connect a deployed instance instead:

```bash
TURO_TARGET_URL=https://your-app.fly.dev npm run connect:turo
```

Once connected, **Turo Sync → Sync now** works from anywhere (including your
phone) — it fetches `https://turo.com/earnings/csv?year=YYYY` (the same CSV
export Turo's own "Download CSV" button on the Transaction History page uses)
using the saved session, for the current and previous year, and imports every
row as an income or expense transaction (negative rows — cancellation fees,
adjustments — are stored as expenses). When the session eventually expires,
sync fails with a clear "session expired" error — just run
`npm run connect:turo` again.

Turo's CSV export has ~47 columns and the exact header names weren't
available while building this (would've required downloading a real export
with live financial data, which felt like the wrong call — this was built by
inspecting the page structure only, plus one live probe that confirmed an
invalid session gets a plain `401`, not a redirect). The importer
(`server/src/turo/sync.js`) matches columns by fuzzy header name (e.g. any
header containing "earnings" or "amount") rather than fixed position, and
keeps the full original row in `raw_data` for every imported transaction —
so if a column is misread, nothing is lost and the mapping in `sync.js` can
be adjusted without re-pulling data.

## Receipt upload

**Upload Receipt** page → pick a photo (or take one with your phone camera)
→ Claude extracts vendor, amount, date, and category → you review/edit before
it's saved as an expense. The original image is kept on the server and
linked from the transaction.

## Categories

- Income: `trip_earning`, `reimbursement`, `extras`, `other_income`
- Expense: `fuel`, `cleaning`, `maintenance`, `insurance`, `toll`, `supplies`,
  `parking`, `fee`, `other_expense`

## Deploying (Fly.io)

Recommended because it's cheap (a few dollars a month for a personal app on
the smallest machine, scale-to-zero when idle) and supports a persistent
volume, which this needs for the SQLite database and uploaded receipts.

1. Sign up at [fly.io](https://fly.io) and install `flyctl`:
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```
2. From the project root:
   ```bash
   fly launch --no-deploy
   ```
   Follow the prompts (it'll detect the `Dockerfile` and `fly.toml` already
   here — pick a unique app name if `turo-accounting` is taken, and it's fine
   to say no to a Postgres/Redis database, this app doesn't use one).
3. Create the persistent volume (must match `fly.toml`'s `source = "turo_data"`
   and be in the same region as `primary_region`):
   ```bash
   fly volumes create turo_data --size 1 --region sjc
   ```
4. Set secrets (never committed — these live only in Fly's config):
   ```bash
   fly secrets set \
     ANTHROPIC_API_KEY=sk-ant-... \
     APP_PASSWORD=some-strong-password \
     SESSION_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
     AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
   ```
5. Deploy:
   ```bash
   fly deploy
   ```
   No local Docker install needed — `fly deploy` builds using Fly's remote
   builder.
6. Connect Turo (from your Mac, one time and again whenever the session
   expires):
   ```bash
   cd server
   TURO_TARGET_URL=https://<your-app-name>.fly.dev npm run connect:turo
   ```

After that, `https://<your-app-name>.fly.dev` works from your phone: view the
dashboard, add manual transactions, upload receipts with your camera, and hit
Sync — all without needing your Mac, except for that one Turo (re)connect step.

The Dockerfile and fly.toml were written by inspecting Fly's docs and this
project's own path assumptions, but haven't been deploy-tested against a real
Fly account (no Docker or Fly account was available in the environment this
was built in) — the first `fly deploy` may need small fixes if something
doesn't line up.

## Known limitations

- Single user, single shared password — not built for multiple people.
- `react-router-dom` and `vite`'s `esbuild` have moderate advisories with no
  fix available for Node 18 (the fixed major versions require Node 20+).
  Low risk for personal use; the Fly deployment builds on Node 20 (see
  `Dockerfile`) so it isn't affected — this only applies to local dev on this
  machine's Node 18. Upgrade Node and run `npm audit fix --force` in
  `client/` if you want to clear it locally too.
- The Turo CSV column mapping (see above) is a best-effort guess, not
  verified against a real export — check the first sync's results against
  your actual Turo earnings page.
- The Docker image runs as root (no `USER` directive) — fine for a
  single-user personal deployment, but worth hardening if this ever grows
  beyond that.
