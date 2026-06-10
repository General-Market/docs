---
title: Rounds, results & history
navTitle: History
description: Round listings, revealed bitmaps, per-player results, source history, asset settlements, and stake ratios.
order: 6
group: Vision API
mode: reference
---

```gmplain
Every finished round leaves a record: who joined, what they predicted, who won, and how the money split on each market. These six endpoints read that record. Predictions stay hidden while a round is open — one endpoint reveals them, but only after the round has resolved, so nobody can copy your picks in time to use them.
```

```gmsummary
GET /vision/rounds :: Latest open round per source, with live players and TVL
GET /vision/rounds/{batchId}/bitmaps :: Predictions revealed after resolution, purged at settlement
GET /vision/rounds/{batchId}/results :: Per-player deposit, payout and PnL for a settled round
GET /vision/source/{sourceId}/history :: Paginated settled-round history for one source
GET /vision/asset/{sourceId}/{assetId}/settlements :: One market's settlement history with player breakdown
GET /vision/batch/{batchId}/ratios :: UP/DOWN stake split per market after settlement
```

All paths are relative to `https://generalmarket.io/api`. No authentication — see [API overview](/docs/developers/overview) (~3 min).

**L3 USDC has 18 decimals.** 0.1 USDC = 1e17. Fields named `tvl`, `deposited`, `payout`, `pnl`, `upStake`, `downStake`, and `effectiveStake` are 18-decimal wei strings unless a section says otherwise.

## GET /vision/rounds

Lists the currently open round — the latest non-paused block — for every source.

```gm-try
{"method": "GET", "path": "/vision/rounds", "params": [{"name": "source", "in": "query", "type": "string", "required": false, "desc": "Display source id, e.g. twitch"}], "body": null, "response": {"rounds": [{"batchId": 301204, "sourceId": "twitch", "source_id": "twitch", "timeframeSecs": 60, "status": "betting", "playerCount": 3, "tvl": "1500000000000000000", "bettingEnd": "2026-06-10T12:34:00+00:00", "configHash": "0x6f1a…"}]}}
```

- `source` (query, optional): a display source id. With it, you get up to the 100 most recent non-paused rounds for that source. Without it, exactly one round per source — the latest.
- `status` is derived from `bettingEnd`: `betting` while the join window is open, `settling` once it has passed.
- `playerCount` and `tvl` are refreshed from on-chain `PlayerJoined` events over roughly the last 30 minutes of blocks, because the oracle's own table can lag the chain by tens of seconds. `tvl` is a wei string.
- `configHash` (omitted when unknown) is the key for fetching the round's market list — see [Blocks & state](/docs/developers/vision-api/batches) (~4 min).
- Disabled sources are filtered out of the listing.
- Upstream failure → `502` with `{"rounds": []}`.

Fields are camelCase; the gateway also writes a `source_id` alias next to `sourceId`.

## GET /vision/rounds/{batchId}/bitmaps

Returns every player's revealed predictions for a round, decoded to booleans — readable only after the round resolves.

```gm-try
{"method": "GET", "path": "/vision/rounds/{batchId}/bitmaps", "params": [{"name": "batchId", "in": "path", "type": "number", "required": true, "desc": "On-chain batch id"}], "body": null, "response": {"batchId": 301204, "markets": ["crypto_bitcoin", "crypto_ethereum", "crypto_solana"], "players": [{"player": "0x9a3f…c21b", "predictions": [true, false, true, false, false, false, false, false]}]}}
```

The timing is the point:

- While the round is open, submitted bitmaps sit in the oracle's *pending* slot. This endpoint reads only the *active* slot, so `players` is empty — predictions are sealed.
- At resolution the oracle flips pending → active. From that moment the bitmaps are readable here.
- After on-chain settlement confirms, the oracle purges the round's bitmaps. The endpoint returns empty arrays again.

**The reveal window runs from resolution to settlement confirmation — usually seconds.** To collect prediction data for backtesting, poll right after each tick resolves. For the persisted outcome of a settled round use `/vision/rounds/{batchId}/results` below — results survive, raw bitmaps do not.

- `markets[i]` is the asset whose prediction is bit `i`: `predictions[i]` is `true` for UP, `false` for DOWN.
- `predictions` is decoded byte by byte, most significant bit first, so its length is a multiple of 8. Bits beyond the market count are padding and read `false`.
- Byte-level spec: [Bitmap encoding](/docs/bots/bitmap-encoding) (~3 min).

## GET /vision/rounds/{batchId}/results

Returns each player's money outcome for a settled round, sorted by PnL descending.

```gm-try
{"method": "GET", "path": "/vision/rounds/{batchId}/results", "params": [{"name": "batchId", "in": "path", "type": "number", "required": true, "desc": "On-chain batch id"}], "body": null, "response": {"batchId": 301204, "players": [{"player": "0x9a3f…c21b", "deposited": "1000000000000000000", "payout": "1499250000000000000", "pnl": "499250000000000000", "correctCount": 2, "totalMarkets": 3}]}}
```

- `deposited`, `payout`, `pnl` are 18-decimal wei strings. `correctCount` and `totalMarkets` count markets.
- A round that has not settled returns `200` with an empty `players` array — not an error.
- Results are persisted in the oracle's database. Unlike bitmaps, they do not disappear after settlement.

## GET /vision/source/{sourceId}/history

Returns the settled-round history of one source, paginated, newest first.

```gm-try
{"method": "GET", "path": "/vision/source/{sourceId}/history", "params": [{"name": "sourceId", "in": "path", "type": "string", "required": true, "desc": "Source id, e.g. twitch"}, {"name": "page", "in": "query", "type": "number", "required": false, "desc": "1-based page (default 1)"}, {"name": "per_page", "in": "query", "type": "number", "required": false, "desc": "Rows per page (default 10, max 50)"}], "body": null, "response": {"batches": [{"batchId": 300998, "status": "settled", "playerCount": 4, "totalPool": 12.5, "avgPnl": 1.04, "topEarnerPnl": 2.61, "topPayout": 5.73, "topEarnerAddress": "0x9a3f…c21b", "timestamp": "2026-06-10T12:30:05+00:00", "bettingStart": "2026-06-10T12:28:00+00:00", "bettingEnd": "2026-06-10T12:29:00+00:00", "settledAt": "2026-06-10T12:30:05+00:00", "marketCount": 24}], "page": 1, "perPage": 10, "totalSettled": 412, "totalPages": 42}}
```

- `page` defaults to 1; `per_page` defaults to 10, max 50.
- **Amounts on this endpoint are USDC numbers, not wei strings.** `totalPool`, `avgPnl`, `topEarnerPnl`, and `topPayout` are already divided by 1e18 and rounded to cents.
- Only rounds that had at least one player appear. `status` is always `"settled"`.
- `topPayout` is the largest gross payout in the round; `topEarnerPnl` is the top earner's net result. A player paid back exactly their deposit has a positive payout but zero PnL.
- Responses are cached for ~30 seconds; settled data is immutable.

## GET /vision/asset/{sourceId}/{assetId}/settlements

Returns one market's settlement history across rounds, with the per-player breakdown.

```gm-try
{"method": "GET", "path": "/vision/asset/{sourceId}/{assetId}/settlements", "params": [{"name": "sourceId", "in": "path", "type": "string", "required": true, "desc": "Source id"}, {"name": "assetId", "in": "path", "type": "string", "required": true, "desc": "Asset id within the source"}, {"name": "limit", "in": "query", "type": "number", "required": false, "desc": "Max rows (default 200, max 500)"}], "body": null, "response": {"settlements": [{"batchId": 300998, "settledAt": "2026-06-10T12:30:05Z", "outcome": "Up", "upStake": "750000000000000000", "downStake": "250000000000000000", "pctChangeBps": 142, "thresholdBps": 0, "resolutionType": 0, "players": [{"player": "0x9a3f…c21b", "side": "Up", "won": true, "effectiveStake": "250000000000000000", "payout": "333333333333333333"}]}]}}
```

- `limit` defaults to 200, clamped to 1–500.
- `outcome` is one of `Up`, `Down`, `Flat`, `Cancelled`, `AllSameSide`, `AllLosers`.
- `pctChangeBps` and `thresholdBps` are basis points; `resolutionType` is a numeric code from the batch config.
- `upStake`, `downStake`, `effectiveStake`, `payout` are wei strings; `side` is `Up` or `Down`.
- `503` with `{"settlements": [], "error": "upstream_unavailable"}` means no oracle answered in time — distinct from `200` with an empty `settlements` array, which means no participants. The gateway races several oracle nodes and returns the first healthy answer.

## GET /vision/batch/{batchId}/ratios

Returns the UP/DOWN stake split per market for a settled block.

```gm-try
{"method": "GET", "path": "/vision/batch/{batchId}/ratios", "params": [{"name": "batchId", "in": "path", "type": "number", "required": true, "desc": "On-chain batch id"}], "body": null, "response": {"batchId": 300998, "markets": [{"assetId": "crypto_bitcoin", "upStake": "750000000000000000", "downStake": "250000000000000000", "upPct": 75.0, "downPct": 25.0, "outcome": "Up", "pctChangeBps": 142, "settledAt": "2026-06-10T12:30:05+00:00"}]}}
```

- `upPct` and `downPct` are percentages to one decimal. A market with zero stake on both sides reports 50/50.
- `upStake` and `downStake` are wei strings; `outcome` uses the same values as the settlements endpoint above.
- A block that has not settled — or an unknown id — returns `200` with an empty `markets` array.

```gmseealso
[{"title": "Blocks & state", "href": "/docs/developers/vision-api/batches"}, {"title": "Players & balances", "href": "/docs/developers/vision-api/players"}, {"title": "How do I win?", "href": "/docs/vision/payouts"}]
```

Next: [Sources, snapshots & search](/docs/developers/vision-api/discovery) (~5 min)
