# Sterling Ops

A cleaning-business operations system: live phone quoting, card-on-file
capture, quote → job → Kanban board, cleaner assignment/dispatch, and a P&L
rollup. Built from the `CLAUDE_CODE_HANDOFF.md` brief and `ops_system_v1.jsx`
prototype (in-memory-only React demo) — this is a from-scratch, independent
implementation of that same workflow, with a real backend and a working
persistence layer.

## Structure

- `server/` — Express API + SQLite (via Node's built-in `node:sqlite`, no
  native deps to install). Owns the data model and all business logic
  (pricing, tier-correction/reconfirmation gate, quote→job conversion,
  cleaner assignment).
- `client/` — Vite + React frontend, ported from `ops_system_v1.jsx` to call
  the real API instead of holding in-memory state.

## Running it

```bash
# terminal 1
cd server
npm install
npm start          # http://localhost:4000

# terminal 2
cd client
npm install
npm run dev         # http://localhost:5173, proxies /api to :4000
```

The SQLite file lives at `server/data/sterling.db` and is created
automatically on first run, seeded with three sample cleaners.

## What's live vs. stubbed

| Piece | Status |
|---|---|
| Persistence (customers/quotes/jobs/cleaners/decisions) | **Live** — real SQLite, survives restarts |
| Pricing model | **Live**, but placeholder numbers carried over from v1 — not verified against real business numbers (see `server/src/services/pricing.js`) |
| Tier-correction + reconfirmation gate | **Live** — correcting a quote's service tier recalculates price and blocks `approve` until the customer reconfirms |
| Quote → Job → Board | **Live** |
| Cleaner assignment + brief generation | **Live**; SMS *send* is stubbed (see below) |
| Card capture (Stripe SetupIntent) | **Scaffolded, not wired to a real account.** Set `STRIPE_SECRET_KEY` to go live; without it, `/api/payments/setup-intent` returns a clearly-marked `{ mocked: true }` response instead of pretending to succeed |
| Cleaner SMS dispatch (Twilio) | **Scaffolded, not wired.** Set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` to go live; without them, sends are logged server-side and returned as `{ mocked: true }` |
| Call recording + transcription attach (OpenPhone/Twilio) | **Webhook receiver only** (`POST /api/telephony/webhook`), shaped for a provider callback (`fromNumber`, `recordingUrl`, `transcript`) that matches on phone number and attaches to the customer record. No provider is actually connected — nothing calls this endpoint yet |
| Auth / multi-user | **Not built** — single implicit operator, matching v1 and the handoff's MVP scope |
| Leads, Cities, Recurring, Calendar, Pay, Backup, Settings | **Not built** — grayed-out nav stubs, matching v1's intentional scope cut |

I don't have Stripe/Twilio/OpenPhone credentials in this environment, so
those three integration points are real call sites with real SDKs
(`stripe`, `twilio`, loaded lazily) gated behind env vars, not fake UI —
add the keys and they start working without further code changes.

## Environment variables (server)

All optional — the app runs fully in "mocked" mode with none of these set.

```
PORT=4000
SQLITE_PATH=./data/sterling.db
STRIPE_SECRET_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
OPENPHONE_API_KEY=
```

`GET /api/health` reports which integrations are currently configured.

## Data model

See `server/src/db.js` for the full schema. Follows the v1 prototype's
shape (`Customer`, `Quote`, `Job`, `Cleaner`) plus two additions called out
in the handoff doc as "business logic worth encoding" even though no UI
consumes them yet:

- `customers.leadSource` / `customers.zone` — lead-source and geo
  attribution, so a future Leads/Cities module has something to join
  against instead of being retrofitted later.
- `decisions` table — a lightweight internal decisions log (area, decision,
  status, date), standing in for the reference system's Notion-style
  business-rules audit trail.
- `cleaners.blacklisted` / `cleaners.reliabilityNotes` — reliability
  flagging; a blacklisted cleaner can't be assigned to a job.

## Known gaps (carried over / still open)

Matches the handoff doc's priority order. Persistence (1) is done. Stripe
(2), telephony (3), and SMS dispatch (4) are wired for real but need
credentials to actually go live. Leads/Cities/marketing attribution,
Recurring, Calendar, and Settings (5) are intentionally not built yet.
