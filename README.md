# Turo Host Accounting

Income/expense tracking for Turo hosts: pulls trip earnings and guest
reimbursements straight from your Turo account, and lets you upload receipts
(fuel, cleaning, maintenance, tolls…) which Claude reads to fill in the
amount/date/category for you. Multi-user — anyone can sign up and gets their
own isolated data — and deployable, so it's usable from your phone, not just
at home.

> **Project status**: functional, but young. It supports multiple accounts
> with properly isolated data, but *connecting* a Turo account still requires
> running a small script on a computer (see "How the Turo connection works"
> below) rather than doing it entirely from the web page — that in-browser
> flow is planned but not built yet (tracked as "Phase B" — see
> [Contributing](#contributing)). Treat this as an early-stage self-hosted
> tool, not a polished consumer product.

## ⚠️ Before you rely on this

- **Turo has no public API for hosts.** This works by reusing your logged-in
  browser session to fetch the same CSV export Turo's own "Download CSV"
  button produces. That's outside what Turo's terms of service anticipate
  for third-party tools, and automated access is the kind of thing platforms
  sometimes rate-limit or block. Use at your own risk; don't be surprised if
  Turo changes something that breaks this.
- **This is not legal, tax, or accounting advice**, and there's no warranty
  (see [LICENSE](LICENSE)). Verify categorization and totals against your
  own records, especially before tax season.
- If you deploy this for other people to use (not just yourself), you are
  the one responsible for their data — their Turo session and their
  financial records will sit on your server. Have a privacy policy and
  terms of service before asking real strangers to sign up; this repo
  doesn't ship with either yet.

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
- `SESSION_ENCRYPTION_KEY` and `AUTH_SECRET` — already generated for you by
  setup; regenerate (see the comment above each) if you want to invalidate
  everyone's saved Turo sessions / login cookies.

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

## Accounts

Anyone can sign up with an email + password (8 characters minimum — there's
no other password strength enforcement or breach-checking yet). Every
account's transactions, receipts, and Turo session are fully isolated from
every other account's — see `server/src/db.js` for the schema and
`req.userId` scoping applied in every route under `server/src/routes/`.
There's no email verification or password-reset flow yet.

## How the Turo connection works

Turo has no public API or OAuth for third-party apps, and login always
requires an SMS code, an email flow, or Google/Apple sign-in — none of which
can be driven unattended with a stored password, and a deployed server
usually has no display to show a browser window on anyway. So today,
connecting requires **a computer with a display** — it doesn't have to be
the server, but it can't (yet) be done purely from a phone browser:

```bash
cd server
npm run connect:turo
```

It'll ask for your **account** email/password (the one you log into this
app with — not Turo's), so it knows whose session to save, then opens a
real, visible browser window — log in to Turo there exactly as you normally
would (phone code, Google, whatever). Nothing you type there is seen by this
app; only the resulting browser session is captured, encrypted, and sent to
wherever the app is running. By default that's your local server; to connect
a deployed instance instead:

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
it's saved as an expense. The original image is kept on the server, under a
per-account folder, and linked from the transaction.

## Categories

- Income: `trip_earning`, `reimbursement`, `extras`, `other_income`
- Expense: `fuel`, `cleaning`, `maintenance`, `insurance`, `toll`, `supplies`,
  `parking`, `fee`, `other_expense`

## Deploying (Fly.io)

Recommended because it's cheap (a few dollars a month on the smallest
machine, scale-to-zero when idle) and supports a persistent volume, which
this needs for the SQLite database and uploaded receipts.

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
     SESSION_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") \
     AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
   ```
5. Deploy:
   ```bash
   fly deploy
   ```
   No local Docker install needed — `fly deploy` builds using Fly's remote
   builder.
6. Sign up an account on the deployed URL, then connect Turo from your Mac
   (one time and again whenever the session expires):
   ```bash
   cd server
   TURO_TARGET_URL=https://<your-app-name>.fly.dev npm run connect:turo
   ```

After that, `https://<your-app-name>.fly.dev` works from your phone: view the
dashboard, add manual transactions, upload receipts with your camera, and hit
Sync — all without needing a computer, except for that one Turo (re)connect
step per account.

The Dockerfile and fly.toml were written by inspecting Fly's docs and this
project's own path assumptions, but haven't been deploy-tested against a real
Fly account (no Docker or Fly account was available in the environment this
was built in) — the first `fly deploy` may need small fixes if something
doesn't line up.

## Contributing

Roadmap, roughly in order:
- **Phase B — in-browser Turo connect.** Replace `connect-turo.js` with an
  embedded remote browser: the server drives an isolated headless Chromium
  per connect attempt, streams it into a `<canvas>` over WebSocket (Chrome
  DevTools Protocol screencast, not a full VNC stack), and forwards input —
  so a user logs into Turo from their own browser tab, nothing to install.
  Needs careful session isolation/cleanup and abuse limits (rate-limiting
  concurrent connect attempts, timeouts) since it means running arbitrary
  headless browser processes on request.
- **Phase C — production hardening**: privacy policy + terms of service,
  rate limiting, email verification / password reset, monitoring, and infra
  sizing once Phase B means running headless Chromium per active connection
  (no longer fits the smallest Fly machine).

## Known limitations

- No email verification or password reset (see Accounts, above).
- `react-router-dom` and `vite`'s `esbuild` have moderate advisories with no
  fix available for Node 18 (the fixed major versions require Node 20+).
  Low risk for personal use; the Fly deployment builds on Node 20 (see
  `Dockerfile`) so it isn't affected — this only applies to local dev on a
  Node 18 machine. Upgrade Node and run `npm audit fix --force` in `client/`
  if you want to clear it locally too.
- The Turo CSV column mapping (see above) is a best-effort guess, not
  verified against a real export — check the first sync's results against
  your actual Turo earnings page.
- The Docker image runs as root (no `USER` directive) — worth hardening
  before this handles real users' data at scale.

## License

[MIT](LICENSE).
