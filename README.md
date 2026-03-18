# PM Trader MVP

Polymarket strategy trading system MVP built with Next.js App Router + TypeScript + Prisma + PostgreSQL.

## Scope

- Market discovery: Gamma API
- Public trade/position reads: Data API
- Orderbook / quote / order execution: CLOB API
- Trading auth: official `@polymarket/clob-client`
- Live trading account scope: `EOA` only in this MVP

## Features

- Dashboard with realtime market snapshot vs strategy state separation
- Market discovery and search
- Market detail with orderbook and manual limit order form
- Two server-side strategies:
  - Threshold breakout
  - Spread / top-of-book imbalance
- Dry-run signal logging
- Live order submission when server credentials are configured
- Orders / trades / positions views with source labels
- Global risk controls, kill switch, cancel-all button, audit logs
- System settings page with server-only secret boundary display

## Local Run

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and update `DATABASE_URL`.
3. Run `npm install`.
4. Run `npm run prisma:generate`.
5. Run `npm run prisma:push`.
6. Run `npm run dev`.

## Docker Compose Run

1. Optional: copy `.env.example` to `.env` and fill in real secrets if needed.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000`.

Notes:

- Compose starts both the app and PostgreSQL.
- If `.env` is missing, built-in defaults are used so the project can still boot.
- The default admin token is `change-me-before-production`. Override it before exposing the app anywhere.

## Optional Live Trading Env

Set these server-only variables before using live CLOB order submission:

- `POLYMARKET_PRIVATE_KEY`
- `POLYMARKET_TRADER_ADDRESS`
- `POLYMARKET_CHAIN_ID=137`
- `POLYMARKET_SIGNATURE_TYPE=0`

## Verified Commands

- `npm run prisma:generate`
- `npm run lint`
- `npm run build`

## Known Limits

- Realtime quotes currently use server-side polling behind `/api/quote`; official WSS market channel is left as a TODO until payload handling is fully confirmed.
- Tag filter query parameters are not wired yet because they still need one more documentation check.
- Allowance / approval setup for first live trade is not automated in this MVP.
- `POLY_PROXY` and `POLY_GNOSIS_SAFE` account modes are intentionally excluded.
