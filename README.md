# CMBEX — Colombo Stock Exchange trading simulator

Practice trading CSE-listed shares with **LKR 100,000 of play money**. Prices are the real
official closes from cse.lk, loaded once a day after the market shuts. Every stock page has a
candlestick chart, moving averages, RSI, MACD, Stochastic and Bollinger Bands, a
buy/sell tally in the style of investing.com, and plain-English explanations of each indicator.

## How it works

```
cse.lk ──(Vercel Cron, 15:15 & 18:00 SL, Mon–Fri)──▶ /api/cron/eod
                                                        │
             ┌──────────────────────────────────────────┤
             ▼                     ▼                     ▼
     market/snapshot         history/{symbol}      settle resting orders
   (every quote, 1 doc)     (daily OHLCV bars)     + rebuild leaderboard
             │                     │
             └──── read directly by the React app (Firestore) ────┘

Browser ──(Firebase ID token)──▶ /api/orders ──▶ Firestore transaction
                                                   (prices from our snapshot,
                                                    never from the browser)
```

**Trading rules** (all in `shared/trading.ts`, covered by tests):

- **Market orders** fill instantly at the last close while the market is closed. Placed during
  the session (09:30–14:30 SL) — or after the close but before new prices land — they wait and
  fill at *that day's* close. This stops people buying at yesterday's price after watching
  today's move on cse.lk.
- **Limit orders** rest for up to 20 trading days and fill when the day's range reaches the
  limit (at the open if it gaps through). Orders placed mid-session only start checking from
  the next day's bar.
- **Fees**: 1.12% per side (`shared/fees.ts`). No shorting, no margin.
- Cash and shares are reserved while orders are open.

## Project layout

| Path | What |
|---|---|
| `shared/` | Pure TypeScript used by both sides: types, fees, calendar, indicators, order rules, cse.lk parsing |
| `server/` | Node-only: Firebase Admin, cse.lk client, daily job, account/order transactions |
| `api/` | Vercel functions: `account`, `orders`, `news`, `cron/eod` |
| `src/` | React app (Vite, Tailwind v4, lightweight-charts) |
| `scripts/` | One-off admin jobs (`eod`, `backfill`, `reset-accounts`) |
| `tests/` | `node:test` unit tests for everything in `shared/` |

## Setup

1. **Vercel environment variables** (Project → Settings → Environment Variables):
   - `FIREBASE_SERVICE_ACCOUNT` — service-account JSON from Firebase console → Project settings →
     Service accounts → *Generate new private key*. Paste the JSON (or base64 of it).
   - `CRON_SECRET` — any long random string (`openssl rand -hex 32`). Vercel Cron sends it automatically.
   - `FIRESTORE_DATABASE_ID` — optional; defaults to the current database.
2. **Deploy the Firestore rules** in `firestore.rules` (Firebase console → Firestore → Rules, or
   `firebase deploy --only firestore:rules`). The new rules make balances server-only.
3. **Load prices once**: after deploying, either
   `curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-domain>/api/cron/eod?force=1"`
   or run locally with `npm run eod -- --force`.
4. **Backfill history** so indicators work immediately (runs from your machine, ~5 minutes):
   `npm run backfill`. Without this, charts build up one bar per trading day.
5. **Clean up legacy data** from the old app (irreversible):
   `npm run reset-accounts -- --confirm`. Old accounts are also reset automatically the first
   time each user signs in.

For local scripts, put the same variables in `.env.local`.

## Development

```bash
npm install
npm run dev      # app + API on http://localhost:3000
npm test         # unit tests
npm run lint     # type-check
npm run build    # production build
```

## Notes

- cse.lk has no official API. We call the same JSON endpoints its website uses, once per day for
  prices. If cse.lk starts blocking Vercel's servers, run `npm run eod` from a machine in
  Sri Lanka on a schedule instead — the job is idempotent.
- Public holidays are detected by cse.lk returning unchanged numbers; the job skips those days.
