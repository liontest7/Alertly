# ALERTLY - Solana Blockchain Monitoring System

**Status:** ✅ FULLY OPERATIONAL — No Database Required  
**Last Updated:** March 13, 2026  
**Build:** Development (running on port 5000)  
**Database:** REMOVED — 100% cookie + localStorage + in-memory

---

## Architecture: Zero Database

All storage is now browser-side or in-memory. No PostgreSQL required.

| Data | Storage |
|------|---------|
| User auth (JWT) | HTTP-only cookie (`auth_token`) |
| User settings & filters | Cookie (`alertly_guest_settings`) — all users |
| Trading wallet (private key) | localStorage only (`alertly_browser_wallet`) |
| Trade history | localStorage only (last 100 trades) |
| Copy trader list | localStorage only |
| Alert history | In-memory (last 500, cleared on restart) |
| Position SL/TP overrides | Cookie (`alertly_positions_v1`) |
| Telegram subscribers | `telegram-bot/data/subscribers.json` |

---

## Auth Flow (Stateless)

1. `/api/auth/nonce` → generates HMAC-signed JWT nonce (no DB write)
2. User signs with Solana wallet
3. `/api/auth/wallet-login` → verifies signature + nonce, issues auth JWT
4. All requests: JWT verified in-process (no DB lookup)
5. User ID = wallet address

---

## Key Files

- **`lib/auth.ts`** — Stateless JWT auth, wallet signature verification, VIP on-chain check
- **`lib/guest-session.ts`** — Cookie-based settings for all users (guest and authenticated)
- **`lib/listeners/blockchain-listener.ts`** — DexScreener polling (boosts + listings)
- **`lib/alert-store.ts`** — In-memory alert buffer (last 500)
- **`lib/alert-listener.ts`** — Lifecycle manager for blockchain listener
- **`lib/browser-wallet.ts`** — localStorage wallet management
- **`lib/browser-trade.ts`** — Browser-side Jupiter trading
- **`lib/browser-trade-history.ts`** — localStorage trade log
- **`lib/browser-copy-trading.ts`** — localStorage copy trader watcher
- **`telegram-bot/src/bot.ts`** — Standalone Telegram bot (no DB)

---

## API Routes

### Active
- `GET/POST /api/settings` — cookie-based settings
- `GET /api/alerts` — live alerts with filter from cookies
- `GET /api/alerts/stream` — SSE stream with filter from cookies
- `GET /api/extension/sync` — extension data from cookies
- `POST /api/auth/nonce` — stateless nonce generation
- `POST /api/auth/wallet-login` — wallet login, sets cookie
- `GET /api/auth/session` — validates JWT cookie
- `POST /api/auth/logout` — clears cookie
- `GET /api/token/[address]` — token data from DexScreener
- `GET /api/health` — system health check

### Stubbed (browser-only)
- `POST /api/trade` — trades run in browser via Jupiter
- `GET /api/trades/history` — returns empty (use localStorage)
- `POST /api/trade/log` — no-op (logs go to localStorage)
- `GET /api/copy-trading` — returns empty (use localStorage)
- `GET /api/trading-wallet` — use browser wallet
- `GET /api/extension/sync` — cookie-based

---

## Alert Logic

### Boosts
- Each real boost (totalAmount increased) creates a separate alert
- No 4-hour dedup — every real increase is shown
- Displays: `+amount this boost` / `total total` if previous boosts exist
- Uses `lastBoostTotalAmounts` Map to detect real increases

### Listings
- Per-session dedup via `seenListingFingerprints` Set
- Each token listed only once per server session

---

## Telegram Bot (Standalone)

- Location: `telegram-bot/`
- Storage: `telegram-bot/data/subscribers.json`
- No DB, no sync with website
- Commands: `/start`, `/stop`, `/settings`, `/status`, `/help`
- Users configure filters directly in Telegram

---

## Chrome Extension

- Location: `chrome-extension/`
- Syncs via `/api/extension/sync` (cookie-based)
- No separate auth needed

---

## VIP / Token Gating

- `VIP_ACCESS_MODE=open` → all users get VIP (default)
- `VIP_ACCESS_MODE=token` → checks on-chain holding of `VIP_TOKEN_MINT`
- No DB lookup — pure on-chain check at login time, stored in JWT

---

## Environment Variables Required

- `AUTH_SECRET` or `JWT_SECRET` — JWT signing key
- `SOLANA_RPC_URL` — Solana RPC endpoint
- `ENCRYPTION_KEY` — for any encrypted data
- `TELEGRAM_BOT_TOKEN` — Telegram bot
- `INTERNAL_API_KEY` — internal API security
- `NEXT_PUBLIC_APP_URL` — public URL
- `ALERTLY_API_BASE_URL` — base API URL

**Note:** `DATABASE_URL` is no longer required.

---

## Prisma

Schema is kept minimal (empty models). The Prisma client is stubbed in `lib/prisma.ts` and will throw if accessed — confirming no accidental DB usage.
