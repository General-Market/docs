# Leaderboard & Profile — Research and Plan

Two pages, two ancestors. Stake gave the world the leaderboard as
spectacle: rank, handle, a number, repeated until somebody wins. Kalshi
gave it the audit: what you bought, what it cost, what it is now,
what's left of it.

We take the spectacle and audit it.

---

## 1. Stake.com — what we keep, what we leave

**Observed (Stake.com `/promotions/promotion/stake-races`, `/casino/races`):**

- Top 1,000 paid daily; daily race resets at 00:00 UTC; live updates every minute.
- Columns: rank, masked handle, wagered, prize.
- Prize column is the visual anchor — gold-tinted, large tabular numbers.
- Top 3 distinguished but compact: a colored rank cell, no trophies on the table itself. The hero panel above the table dramatizes #1.
- Long handles middle-truncate. Tabular-num font for every number column.
- Time selector: tabs (daily / weekly / monthly) above the table.
- Live indicator: "live" badge with pulse near the title. Total prize pool front and center.

**What we steal:**

- Density. Every row is a bet on attention. No padding charity.
- Tabular numerals everywhere a number lives.
- A time-window toggle that lives near the title, not buried.
- A live indicator that admits the data moves.
- Top-3 visually different but never gold-trophy garish.

**What we leave behind:**

- Wager-as-virtue. Stake measures who burned the most. We measure PnL.
  A leaderboard of losers who staked hard is not a leaderboard.
- Prize column. We have no daily prize pool yet. Pretending we do is
  the kind of lie that ages badly.
- The casino tone — neon, gold, "WIN BIG." We're dark-native, cream
  wordmark, red period. Restraint is the brand.

---

## 2. Kalshi — what we keep, what we leave

**Observed (`help.kalshi.com/en/articles/13823844-portfolio`, websocket docs, Substack post on prediction-market UX):**

- Portfolio = cash + current value of open positions + resting orders.
- Per-position columns: contracts owned, average purchase price, current
  position value, total expected payout.
- Realized PnL, fees paid, position size delivered through the websocket.
- Known weakness (per Substack): PnL is computed off a midpoint that
  doesn't survive a market-sell. Honesty problem.

**What we steal:**

- Cost basis. We know what each fill cost — show it.
- Settlement state per row. A position is open, settling, or done.
- Realized vs. unrealized split, when both exist.
- The portfolio header: cash, exposure, lifetime PnL, win rate. One
  row of stats above one table.

**What we leave behind:**

- Institutional flatness. Every row reads the same. No texture, no rail.
- Midpoint-PnL mythology. We use realized PnL from on-chain claims;
  unrealized for our parimutuel pools is meaningless until the market
  closes (no liquid secondary market). State the truth: open positions
  show stake at risk, not unrealized PnL.

---

## 3. Data sources — indexer Postgres

The event indexer on VPS 3 (`prediction_market_indexer`, schema
`prediction_market`) is source of truth. Tables already used by nsgame
routes:

- `bet_placed` (signature, slot, block_time, market, owner, side, amount)
- `market_closed` (signature, market, baseline_price)
- `market_resolved` (signature, market, baseline_price, final_price, outcome_yes, force_resolved)
- `claimed` (signature, market, owner, net, fee, stranded)
- `market_instantiated` (market, source_id, threshold_bps, close_time, settlement_time, creator)

**USDC:** Solana SPL USDC, 6 decimals on this side. Confirmed by every
`USDC_DECIMALS = 6` in the existing components.

**PnL math:**

- `pnl_realized = sum(claimed.net) - sum(bet_placed.amount where market is resolved)`
- For positions still open or settling, `stake_at_risk = sum(bet_placed.amount)`. We do not invent unrealized PnL.
- Volume = `sum(bet_placed.amount)`.
- Win rate = `count(distinct market where claimed.net > 0) / count(distinct resolved market)`.
- Last active = `max(bet_placed.block_time)`.

The leaderboard query is one rollup over `bet_placed` left-joined to
`claimed` and `market_resolved`, grouped by `owner`, filtered by a time
window on `bet_placed.block_time`.

The handle is the wallet pubkey, base58. Until ENS-on-Solana exists,
the handle IS the address. `/u/[handle]` accepts a base58 wallet.

---

## 4. Routes & data wiring

Existing route shape: `app/[locale]/(app)/...`

- `/leaderboard` → `app/[locale]/(app)/leaderboard/page.tsx`
  - Server component, fetches via `lib/indexer/pg.ts` directly.
  - Time window selector (24h / 7d / 30d / all) is a client component
    that reads `?window=` from the URL.
  - URL: `/leaderboard?window=7d` (default 7d).
- `/u/[handle]` → `app/[locale]/(app)/u/[handle]/page.tsx`
  - Server component, fetches header stats via `pg.ts`.
  - Open positions table reuses the existing `/api/positions/[wallet]`
    query but lifted into a server function shared with the page.
  - PnL chart: lightweight inline SVG sparkline (already a pattern in
    `components/markets/SparkLine.tsx` / `components/ui/NavSparkline.tsx`).
    No new chart dep. recharts is in deps but heavier than needed.
  - Recent fills: reuses the row treatment from `GlobalActivity` — same
    typography, same scale.

API routes added:

- `GET /api/leaderboard?window=24h|7d|30d|all&limit=&offset=` →
  `{ entries: [{ wallet, volume, pnlRealized, winRate, betsCount, lastActive }] }`
- The `/u/[handle]` page does NOT need a new endpoint; it composes
  `/api/positions/[wallet]` (already exists) plus a new
  `/api/users/[wallet]/summary` route that returns the header stats and
  a daily PnL series for the sparkline.

`POSTGRES_URL` missing → both pages render empty states. Same graceful
pattern as `/api/positions/[wallet]`.

---

## 5. Components added

Under `nsgame/components/leaderboard/`:

- `LeaderboardTable.tsx` (server) — semantic `<table>`, sticky `<thead>`.
- `WindowToggle.tsx` (client) — 24h / 7d / 30d / all. Reads/writes URL.
- `RankCell.tsx` (server) — top-3 with a single-character mark; rest plain.
- `WalletLink.tsx` (server) — short address, monospaced, hover reveals full.

Under `nsgame/components/profile/`:

- `ProfileHeader.tsx` (server) — handle, joined date, volume, PnL, win rate.
- `PnlSparkline.tsx` (client) — small SVG sparkline of daily PnL (last 30d).
- `PositionsTable.tsx` (server) — open positions, Kalshi-style columns.
- `RecentFills.tsx` (server) — last 25 fills, reuses GlobalActivity row idiom.

What we DO NOT duplicate:

- `SourceIcon`, `formatUsdcUnits`, `relativeTime`, `shortAddr` — pulled
  from existing files. If a helper isn't already exported, we export it
  rather than copy it.

---

## 6. Voice

Cioran register, applied to the visible copy:

- Empty leaderboard: "no rank yet. someone has to lose first."
- Empty profile positions: "nothing open. either you finished or you never started."
- Profile PnL when zero: "0 USDC. the market hasn't decided what you are."
- Window selector default: 7d, because 24h is too volatile to mean anything and "all" is too forgiving to mean anything either.

No emojis. No "exciting." No "you're #1!". A leaderboard that announces
its winners with the same font as its losers.

---

## 7. Phases

1. Add `/api/leaderboard` and `/api/users/[wallet]/summary`.
2. Build `/leaderboard` page (server + client toggle).
3. Build `/u/[handle]` page (server + sparkline + positions + fills).
4. `npx tsc --noEmit`. `npx eslint . --quiet`.
5. Commit with Cioran-register message. Push to `mono main`. No Dokploy
   for nsgame yet (per `docs/indexer-wiring.md` §3) — push is enough.
