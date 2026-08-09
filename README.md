# Turo Host Accounting

Income/expense tracking for Turo hosts: pulls trip earnings and guest
reimbursements straight from your Turo account, and lets you upload receipts
(fuel, cleaning, maintenance, tolls…) which Claude reads to fill in the
amount/date/category for you. Multi-user — anyone can sign up and gets their
own isolated data — and deployable, so it's usable from your phone, not just
at home, including connecting your own Turo account from your phone's
browser.

> **Project status**: functional, but young. Multi-account with properly
> isolated data, and Turo connect now happens entirely in the browser (see
> below) — no local script or install required. Treat this as an
> early-stage self-hosted tool, not a polished consumer product; see
> [Contributing](#contributing) for what's still missing before "real
> product."

## ⚠️ Before you rely on this

- **Turo has no public API for hosts.** This works by driving a real browser
  session against turo.com and reusing the resulting login session to fetch
  the same CSV export Turo's own "Download CSV" button produces. That's
  outside what Turo's terms of service anticipate for third-party tools —
  Cloudflare (which fronts turo.com) already actively blocks naive automated
  access (see below), and there's no guarantee it won't catch and block this
  approach too as it evolves. Use at your own risk; don't be surprised if
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
npx playwright install chromium   # only needed once, powers Turo connect
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

Runs on http://localhost:5174 and proxies `/api/*`, `/uploads/*`, and
`/ws/*` to the server.

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
can be driven unattended with a stored password. So **Turo Sync → Connect
Turo** drives an isolated, real browser session on the server for you to log
into by hand — the page streams live into a `<canvas>` (Chrome DevTools
Protocol screencast over WebSocket, not a stored video — see
`server/src/turo/browserSessions.js` and `browserSocket.js`), and your
clicks/keystrokes are forwarded into it. Nothing you type is seen by this
app beyond that video feed; once you're logged in, the resulting browser
session (not your password) is captured and encrypted.

**This has to run headed, not headless.** A live probe during development
found that Cloudflare (which fronts turo.com) returns a hard "Sorry, you've
been blocked" page to Chromium's real headless mode, but loads normally in
headed mode from the identical environment — so the connect-session browser
launches with `headless: false`. On Linux (the Docker deployment) that needs
a virtual display since there's none physically present; `server/src/turo/xvfb.js`
starts one (`Xvfb`) on demand. On macOS/Windows dev machines this is a
no-op — headed mode already works natively, so running this locally will
briefly pop open a real, visible Chromium window per connect attempt (same
as opening any other app).

Only one connect session is allowed per account at a time (starting a new
one replaces your own prior one), and a global cap across all accounts
(`MAX_CONCURRENT_TURO_SESSIONS`, default 3) limits how many headless-turned-headed
Chromium instances can run at once — since this means running arbitrary
browser processes on request, that cap exists specifically to bound resource
use and abuse, not as an arbitrary throttle. Sessions self-destruct after 10
minutes or when their WebSocket closes.

Prefer the command line? `npm run connect:turo` (in `server/`) still works —
it asks for your account email/password, then opens a real local browser
window the same way, useful if you'd rather not do this from a browser tab,
or want to connect a deployed instance without going through its web UI:

```bash
TURO_TARGET_URL=https://your-app.fly.dev npm run connect:turo
```

Once connected (either way), **Sync now** works from anywhere (including
your phone) — it fetches `https://turo.com/earnings/csv?year=YYYY` (the same
CSV export Turo's own "Download CSV" button on the Transaction History page
uses) using the saved session, for the current and previous year, and
imports every row as an income or expense transaction (negative rows —
cancellation fees, adjustments — are stored as expenses). When the session
eventually expires, sync fails with a clear "session expired" error — just
connect again.

Turo's CSV export has ~47 columns and the exact header names weren't
available while building this (would've required downloading a real export
with live financial data, which felt like the wrong call — this was built by
inspecting the page structure only, plus a live probe that confirmed an
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
per-account folder, and served back only to the account that owns it.

## Categories

- Income: `trip_earning`, `reimbursement`, `extras`, `other_income`
- Expense: `fuel`, `cleaning`, `maintenance`, `insurance`, `toll`, `supplies`,
  `parking`, `fee`, `other_expense`

## Deploying (Fly.io)

Recommended for its persistent volume (needed for the SQLite database and
uploaded receipts) and scale-to-zero pricing. Budget for more than the
absolute cheapest tier now, though — the server runs real Chromium instances
on demand for Turo connect, which needs real memory headroom (see
`fly.toml`).

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
   builder. The image now installs Chromium + its Linux dependencies
   (`npx playwright install --with-deps chromium` in the `Dockerfile`), so
   the build takes longer and the image is larger than a typical small Node
   app.
6. Sign up an account on the deployed URL, then use **Turo Sync → Connect
   Turo** right there in the browser — including from your phone.

The Dockerfile and fly.toml were written by inspecting Fly's docs and this
project's own path assumptions, but haven't been deploy-tested against a real
Fly account (no Docker or Fly account was available in the environment this
was built in) — the first `fly deploy` may need small fixes if something
doesn't line up. The in-browser Turo connect flow itself *has* been tested
end-to-end locally against the real turo.com (screen streaming, click/type
forwarding, session teardown, and the concurrency cap all verified working)
— just not yet inside the actual Docker/Xvfb path this deploy step produces.

## Contributing

Roadmap, roughly in order:
- **Phase C — production hardening**: privacy policy + terms of service,
  IP-based rate limiting (today's abuse controls are per-account + a global
  concurrency cap only — see "How the Turo connection works"), email
  verification / password reset, monitoring, non-root Docker user, and
  validating the Xvfb/headed-Chromium path actually works inside a real
  Fly.io deploy (only tested on macOS locally so far).

## Known limitations

- No email verification or password reset (see Accounts, above).
- Turo Connect's keyboard forwarding handles basic ASCII input (letters,
  digits, punctuation, backspace/tab/enter) — no IME/international input.
- Only one Turo connect session per account at a time, and a small global
  concurrency cap across all accounts (see above) — by design, but it means
  a busy deployment can make people wait to connect.
- In local dev, closing the Turo Connect tab while going through Vite's dev
  proxy (port 5174) doesn't always cleanly close the underlying WebSocket
  (a Vite/http-proxy quirk, confirmed by testing directly against the
  server's own port instead, where teardown was always clean) — the 10
  minute absolute session timeout is the backstop. Doesn't affect production
  (no separate dev proxy there, single process).
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
  before this handles real users' data at scale. Chromium is launched with
  `--no-sandbox` because of this; fixing the root issue would let that be
  removed too.

## License

[MIT](LICENSE).
