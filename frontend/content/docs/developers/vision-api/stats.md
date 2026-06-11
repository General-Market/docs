---
title: Leaderboard and stats
navTitle: Stats
description: The leaderboard with pagination, global counters, activity time-series, trending bots, and the explorer endpoints.
order: 8
group: Vision API
mode: reference
---

```gmplain
These endpoints answer the scoreboard questions: who is winning overall, how busy the system is, which example bots exist, and how each source has performed over its lifetime. They are read-only and need no login.
```

```gmsummary
GET /vision/leaderboard :: Players ranked by PnL — paginated, filterable by source or block
GET /vision/stats/global :: Two lifetime counters: total markets, total settled markets
GET /vision/activity :: Rounds created and settled per time bucket
GET /vision/bots/trending :: Example bots from the public GitHub repo
Explorer endpoints :: Per-source lifetime rollups and tie-rate series
```

All paths are relative to `https://generalmarket.io/api`. No authentication — see [API overview](/docs/developers/overview) (~3 min).

**L3 USDC has 18 decimals.** 0.1 USDC = 1e17. Fields ending in `_wei` are 18-decimal wei strings; leaderboard money fields are already converted to USDC.

## GET /vision/leaderboard

Returns players ranked by profit and loss, paginated.

```gm-try
{"method": "GET", "path": "/vision/leaderboard", "params": [{"name": "page", "in": "query", "type": "number", "required": false, "desc": "1-based page (default 1)"}, {"name": "limit", "in": "query", "type": "number", "required": false, "desc": "Rows per page (default 50, max 200)"}, {"name": "source_id", "in": "query", "type": "string", "required": false, "desc": "Limit to one source (alias: source)"}, {"name": "batch_id", "in": "query", "type": "number", "required": false, "desc": "Limit to one block — ignored when source_id is set"}], "body": null, "response": {"leaderboard": [{"rank": 1, "walletAddress": "0x9a3f…c21b", "pnl": 41.27, "winRate": 62.5, "roi": 8.61, "totalVolume": 479.5, "portfolioBets": 96, "avgPortfolioSize": 0, "largestPortfolio": 0, "roundsPlayed": 96, "roundsWon": 60, "avgCorrectPct": 57.1}], "total": 1843, "page": 1, "limit": 50, "pages": 37, "updatedAt": "2026-06-10T12:31:00.000Z"}}
```

Envelope: `{leaderboard, total, page, limit, pages, updatedAt}`. The gateway computes the full board upstream, then slices the requested page — `total` and `pages` describe the whole board.

Entry fields:

| Field | Meaning |
|---|---|
| `rank` | 1-based position, sorted by PnL descending |
| `walletAddress` | the player's address |
| `pnl` | net profit in USDC, whole cents — the closed-set sum reconciles to exactly zero |
| `winRate` | % of rounds with positive PnL, one decimal |
| `roi` | `pnl / totalVolume × 100`, two decimals |
| `totalVolume` | total USDC deposited across rounds |
| `portfolioBets` | rounds joined (same count as `roundsPlayed`) |
| `roundsPlayed`, `roundsWon` | rounds joined / rounds with positive PnL |
| `avgCorrectPct` | % of individual markets called correctly, one decimal |

- Filters: `source_id` (alias `source`) for one source's lifetime board; `batch_id` for a single block. When both are sent, `source_id` wins.
- **`avgPortfolioSize` and `largestPortfolio` are always 0** in the current implementation.
- Upstream failure → `502` with `{"leaderboard": [], "updatedAt": …}`.

## GET /vision/stats/global

Returns two lifetime counters: total live markets and total settled markets.

```gm-try
{"method": "GET", "path": "/vision/stats/global", "params": [], "body": null, "response": {"totalMarkets": 41230, "totalSettled": 9120044}}
```

- `totalSettled` counts settled *markets*, not blocks — one settled block carrying 1,200 markets adds 1,200.
- Each value is a number or `null`. `null` means that upstream fetch failed; `0` is a real zero.
- Cached ~60 seconds.

## GET /vision/activity

Returns rounds created, rounds settled, and player participation per time bucket.

```gm-try
{"method": "GET", "path": "/vision/activity", "params": [{"name": "range", "in": "query", "type": "string", "required": false, "desc": "1h | 6h | 24h | 7d (default 24h)"}, {"name": "bucket_mins", "in": "query", "type": "number", "required": false, "desc": "Bucket size in minutes, 1-60 (default 5)"}], "body": null, "response": {"buckets": [{"bucket": "2026-06-10T12:00:00Z", "rounds_settled": 41, "rounds_created": 43, "total_players": 87}], "range": "24h", "bucket_mins": 5}}
```

- `range` outside the four allowed values → `400 {"error": "Invalid range"}`; `bucket_mins` outside 1–60 → `400`.
- `total_players` sums the player counts of rounds settled in that bucket.
- At most 2,000 buckets are returned. Field names here are snake_case, unlike most Vision endpoints.

## GET /vision/bots/trending

Returns the example bots published in the public GitHub repo `General-Market/vision-bot-examples`.

```gm-try
{"method": "GET", "path": "/vision/bots/trending", "params": [{"name": "source", "in": "query", "type": "string", "required": true, "desc": "Source id — the matching bot sorts first; 400 without it"}], "body": null, "response": {"bots": [{"name": "twitch bot", "path": "twitch", "lastCommitAt": "2026-05-28T09:14:33Z", "htmlUrl": "https://github.com/General-Market/vision-bot-examples/tree/main/twitch", "description": "Reference bot for the twitch source.", "sparkline7d": null}]}}
```

- `source` is required (`400` without it). The bot whose directory matches it sorts first; the rest follow alphabetically.
- `description` is the first paragraph of the bot's README; `sparkline7d` is always `null`.
- When GitHub is unreachable: `200` with `{"bots": [], "_stub": true, "reason": "…"}`.
- Cached ~1 hour. Build your own bot: [Run the reference bot in 5 minutes](/docs/bots/quickstart) (~5 min).

## Explorer endpoints

Three read-only rollups feed the explorer page; all are GET with no parameters.

| Endpoint | Returns | Response shape |
|---|---|---|
| `/vision/explorer/source-stats` | lifetime per-source rollup | `{"sources": [{"source_id", "last_settled_at", "settled_batches", "settled_markets", "trader_count", "total_deposited_wei"}]}` |
| `/vision/explorer/tie-rate-history` | hourly tie-rate buckets per source, last 60 days | `{"history": [{"hour", "source_id", "total_rounds", "ties"}]}` |
| `/vision/explorer/tie-rates` | per-source tie percentage | `{"tieRates": [{"source", "total", "ties", "pct"}]}` |

```gm-try
{"method": "GET", "path": "/vision/explorer/source-stats", "params": [], "body": null, "response": {"sources": [{"source_id": "twitch", "last_settled_at": "2026-06-10T12:30:05Z", "settled_batches": 5120, "settled_markets": 122880, "trader_count": 214, "total_deposited_wei": "8123450000000000000000"}]}}
```

- A *tie* is a round where every participating player ended with PnL exactly zero. Only rounds with more than one player count.
- `settled_markets` sums each settled block's market count — the per-source twin of `totalSettled` above.
- `total_deposited_wei` is an 18-decimal wei string.
- **`/vision/explorer/tie-rates` serves a static snapshot.** The oracle has no handler for that path yet; the gateway answers from a hardcoded fallback captured from the database at build time.

```gmseealso
[{"title": "Read the leaderboard", "href": "/docs/vision/leaderboard"}, {"title": "Players and balances", "href": "/docs/developers/vision-api/players"}]
```

Next: [Vault contract and endpoints](/docs/developers/vision-api/vaults) (~4 min)
