---
title: Players & balances
navTitle: Players
description: Player profile with PnL and accuracy, round-by-round history, and the truth about the balance endpoint.
order: 5
group: Vision API
mode: reference
---

```gmplain
Two endpoints describe any player. The profile gives the headline numbers — total profit, win rate, every block they played, and a chart-ready running profit line. The rounds endpoint gives the raw round-by-round results as exact on-chain amounts. There is no working balance endpoint; read the wallet's USDC balance from the chain instead.
```

```gmsummary
GET /vision/player/{address}/profile :: Display-ready stats, per-batch breakdown, cumulative PnL chart
GET /vision/player/{address}/rounds :: Raw round results as 18-decimal wei strings
GET /vision/balance :: Not live — every call returns 404; read the chain instead
```

## GET /vision/player/{address}/profile

Returns a player's complete record in one call: aggregate stats, a per-batch breakdown, and an hourly cumulative-PnL series.

```gm-try
{"method": "GET", "path": "/vision/player/0x71C7656EC7ab88b098defB751B7401B5f6d8976F/profile", "params": [{"name": "address", "in": "path", "type": "string", "required": true, "desc": "0x-prefixed 40-hex player address"}], "body": null, "response": {"stats": {"pnl": 12.41, "totalDeposited": 220.0, "roi": 5.64, "winRate": 52.3, "totalBatches": 215, "lastActiveAt": "2026-06-10T14:32:11+00:00"}, "batches": [{"batchId": 301204, "sourceId": "crypto", "status": "active", "deposited": 1.0, "balance": 1.0, "tickCount": 0, "roi": 0.0, "ticks": []}, {"batchId": 301190, "sourceId": "crypto", "status": "exited", "deposited": 1.0, "balance": 1.13, "tickCount": 1, "roi": 13.0, "ticks": [{"tickId": 1781180531, "pnl": 0.13, "won": true}]}], "pnlHistory": [{"timestamp": "2026-06-10T13:00:00+00:00", "pnl": 12.28}, {"timestamp": "2026-06-10T14:00:00+00:00", "pnl": 12.41}]}}
```

All amounts here are **display-ready USDC floats rounded to 2 decimals** — not wei strings. The raw amounts live on the rounds endpoint below.

`stats`:

| Field | Type | Meaning |
|---|---|---|
| `pnl` | number | Lifetime profit/loss in USDC |
| `totalDeposited` | number | Lifetime deposits in USDC |
| `roi` | number | `pnl / totalDeposited × 100`, as a percentage |
| `winRate` | number | Rounds with positive PnL ÷ total rounds, ×100, rounded to 0.1 |
| `totalBatches` | number | Batches ever joined |
| `lastActiveAt` | string \| null | Timestamp of the most recent settled round |

`batches` — one entry per batch the player joined, sorted active-first then by `tickCount` descending:

| Field | Type | Meaning |
|---|---|---|
| `batchId` | number | The batch |
| `sourceId` | string | Plain source name, `"unknown"` if unresolved |
| `status` | string | `"active"` or `"exited"` — exited once settled *or* past its settlement deadline |
| `deposited` | number | USDC put in |
| `balance` | number | `deposited + pnl` for that batch |
| `tickCount` | number | Settled rounds recorded for this batch (0 or 1 — a batch lives one round) |
| `roi` | number | Percentage return on this batch |
| `ticks` | array | `{tickId, pnl, won}` — `tickId` is the settlement's unix timestamp |

`pnlHistory` is the cumulative PnL bucketed to hour boundaries and downsampled to ~200 points — feed it straight to a chart.

Errors: `400 {"error": "Invalid address"}` for a malformed address; `502 {"error": "Profile unavailable"}` when the oracle is unreachable. Responses are cached for 30 seconds.

## GET /vision/player/{address}/rounds

Returns the player's raw round-by-round results, newest batch first.

```gm-try
{"method": "GET", "path": "/vision/player/0x71C7656EC7ab88b098defB751B7401B5f6d8976F/rounds", "params": [{"name": "address", "in": "path", "type": "string", "required": true, "desc": "Player address"}, {"name": "limit", "in": "query", "type": "number", "required": false, "desc": "Rows to return — default 20, max 100"}], "body": null, "response": {"rounds": [{"batchId": 301190, "deposited": "1000000000000000000", "payout": "1130000000000000000", "pnl": "130000000000000000", "correctCount": 14, "totalMarkets": 24}]}}
```

| Field | Type | Meaning |
|---|---|---|
| `batchId` | number | The settled batch |
| `deposited` | string | Deposit, 18-decimal wei string |
| `payout` | string | What settlement paid out, wei string |
| `pnl` | string | `payout − deposited`, wei string — negative on a losing round |
| `correctCount` | number | Markets predicted correctly |
| `totalMarkets` | number | Markets in the batch |

**L3 USDC has 18 decimals.** `"130000000000000000"` is 0.13 USDC.

A database failure returns `200` with `{"rounds": []}` — this endpoint never returns 500. An address that has played no rounds also returns the empty array; the two cases are indistinguishable.

## GET /vision/balance

**This endpoint is not live.** A handler for `GET /vision/balance/{batch_id}/{player}` exists in the oracle codebase but is not mounted on its router — every call returns `404`, on every oracle. Older references (including the repo's bot instructions) describe it as working; they are stale.

To get what it would have told you:

- **A player's spendable USDC** — read `balanceOf(player)` on the L3 USDC contract directly. The token address comes from `Vision.USDC()` or the [Network reference](/docs/get-started/network) (~2 min).
- **A player's stake in a batch** — read the `deposit` field in [`/vision/batch/{id}/state`](/docs/developers/vision-api/batches) (~4 min), or `Vision.getPosition` on-chain.

There is no money parked with the oracle to query: USDC moves wallet → contract on join and contract → wallet at settlement. See [Where is my money?](/docs/vision/your-money) (~3 min).

```gmseealso
[{"title": "Leaderboard & stats", "href": "/docs/developers/vision-api/stats"}, {"title": "Rounds, results & history", "href": "/docs/developers/vision-api/history"}, {"title": "Leaderboard and your stats", "href": "/docs/vision/leaderboard"}]
```

Next: [Rounds, results & history](/docs/developers/vision-api/history) (~4 min)
