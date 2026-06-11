---
title: Blocks and state
navTitle: Blocks & state
description: List open blocks, read one block's full state, and resolve a market list by source or config hash.
order: 3
group: Vision API
mode: reference
---

```gmplain
Four read endpoints, no keys needed. One lists every block (round) you can join right now. One shows everything inside a single block, including who joined. The last two answer "which markets does this block contain?" — by source name, or by the fingerprint (hash) the block carries on-chain.
```

```gmsummary
GET /vision/batches :: Latest open block per source, verified against the chain
GET /vision/batch/{id}/state :: One block's full state, including its player list
GET /vision/config/{source} :: Latest market list for a source by name
GET /vision/config/by-hash/{hash} :: Resolve a configHash to its canonical market list
```

## GET /vision/batches

Returns the latest open block — a *batch*, one round of one tick — for every source, verified against the chain.

```gm-try
{"method": "GET", "path": "/vision/batches", "params": [], "body": null, "response": {"batches": [{"id": 301204, "creator": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "source_id": "crypto", "config_hash": "0x3f2a9c41d8b07e6a55c0f1d92e84b6a7c3d51e08f4b29a6c7d80e13f5a4b6c2d", "tick_duration": 120, "player_count": 38, "tvl": "92000000000000000000", "paused": false, "current_tick": 0, "market_count": 24}]}}
```

The route is not a plain proxy. Between the oracle and you it does four things:

- **Patches zero config hashes.** When the oracle reports a batch whose `config_hash` is missing or all zeros, the route fills it in from the static deploy output, so every batch you see carries a resolvable hash.
- **Resolves source ids.** On-chain, a batch's source id is the keccak256 hash of the source name. The route maps known hashes back to display names (`crypto`, `defi`, …); an unrecognised hash passes through raw.
- **Deduplicates.** Only the latest (highest-id) non-paused batch per source survives. Paused batches are filtered out before deduplication.
- **Verifies on-chain.** Each candidate id is checked with a single multicall of `getBatch` against the Vision contract; batches the contract reverts on are dropped. Verification results are cached for 30 seconds. If the RPC is unreachable, or every check fails at once, the route fails open and returns all candidates rather than an empty list.

Response fields, per batch:

| Field | Type | Meaning |
|---|---|---|
| `id` | number | Batch id — pass it to `joinBatchDirect` and the state endpoint |
| `creator` | string | Address that created the batch |
| `source_id` | string | Display source name, or the raw hash if unresolved |
| `config_hash` | string | keccak256 of the market config — resolve with `/vision/config/by-hash/{hash}` |
| `tick_duration` | number | Seconds per round |
| `player_count` | number | Players who joined |
| `tvl` | string | Sum of all deposits, as an 18-decimal wei string |
| `paused` | bool | Always `false` here — paused batches are filtered |
| `current_tick` | number | Always `0` — legacy field from the retired multi-tick engine |
| `market_count` | number | Markets in this batch |

**L3 USDC has 18 decimals.** A `tvl` of `"92000000000000000000"` is 92 USDC.

If the oracle is unreachable the route returns `502` with `{"batches": []}`. Responses are cached for 30 seconds.

```gmnote
The market list is deliberately absent. It is long and identical for every batch built from the same source — fetch it once per config_hash, not once per batch.
```

## GET /vision/batch/{id}/state

Returns the full state of one batch, including every player in it.

```gm-try
{"method": "GET", "path": "/vision/batch/{id}/state", "params": [{"name": "id", "in": "path", "type": "number", "required": true, "desc": "Batch id"}], "body": null, "response": {"id": 301204, "creator": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "source_id": "crypto", "config_hash": "0x3f2a9c41d8b07e6a55c0f1d92e84b6a7c3d51e08f4b29a6c7d80e13f5a4b6c2d", "tick_duration": 120, "created_at_tick": 14843621, "paused": false, "player_count": 1, "next_tick": 0, "players": [{"address": "0x71c7656ec7ab88b098defb751b7401b5f6d8976f", "deposit": "1000000000000000000", "balance": "1000000000000000000", "start_tick": 0, "has_bitmap": true}]}}
```

This path is served by the oracle directly. `created_at_tick` is the contract's `block.timestamp / tickDuration` at creation. `next_tick` and each player's `start_tick` are always `0` — single-round batches have no tick sequence.

Per player:

| Field | Type | Meaning |
|---|---|---|
| `address` | string | Player wallet (lowercase) |
| `deposit` | string | Deposit committed this round, 18-decimal wei string |
| `balance` | string | Mirrors `deposit` — the deposit is the stake |
| `start_tick` | number | Always `0` |
| `has_bitmap` | bool | `true` if the oracle holds a pending or active bitmap for this player |

An unknown id returns `404` with `{"error": "Batch 301204 not found"}`.

## GET /vision/config/{source}

Returns the latest market list for a source, by name.

```gm-try
{"method": "GET", "path": "/vision/config/{source}", "params": [{"name": "source", "in": "path", "type": "string", "required": true, "desc": "Source name, max 64 chars"}], "body": null, "response": {"sourceId": "crypto", "displayName": "Crypto", "configHash": "0x3f2a9c41d8b07e6a55c0f1d92e84b6a7c3d51e08f4b29a6c7d80e13f5a4b6c2d", "tickDurationSecs": 120, "lockOffsetSecs": 30, "settlementGraceSecs": 240, "markets": [{"assetId": "BTC", "resolutionType": "up_x", "thresholdBps": 150, "thresholdSource": "last_batch"}, {"assetId": "ETH", "resolutionType": "down_0", "thresholdBps": 0, "thresholdSource": "24h_history"}], "createdAt": "2026-06-10T12:00:00Z"}}
```

The route translates the display id to the internal source id first, then retries with the raw name. A missing source name, or one longer than 64 characters, returns `400` with `{"markets": []}`. A source with no known config returns `200` with `{"markets": []}` — check the array, not the status.

Per market:

| Field | Type | Meaning |
|---|---|---|
| `assetId` | string | The asset this bit predicts |
| `resolutionType` | string | `up_x` / `down_x` (per-market threshold) or `up_0` / `down_0` (any move wins) |
| `thresholdBps` | number | Threshold in basis points (150 = 1.5%), clamped to 10000 |
| `thresholdSource` | string | Where the threshold came from: `last_batch`, `24h_history`, or `no_data` |

`displayName` and `configHash` can be absent when the config is served from the database fallback rather than the live generator. Responses are cached for 5 minutes.

## GET /vision/config/by-hash/{hash}

Resolves a `config_hash` to its canonical market list — this is how a bot maps bit positions to assets.

```gm-try
{"method": "GET", "path": "/vision/config/by-hash/{hash}", "params": [{"name": "hash", "in": "path", "type": "string", "required": true, "desc": "0x-prefixed 32-byte hex config hash"}], "body": null, "response": {"sourceId": "crypto", "configHash": "0x3f2a9c41d8b07e6a55c0f1d92e84b6a7c3d51e08f4b29a6c7d80e13f5a4b6c2d", "tickDurationSecs": 120, "lockOffsetSecs": 30, "settlementGraceSecs": 240, "markets": [{"assetId": "BTC", "resolutionType": "up_x", "thresholdBps": 150, "thresholdSource": "last_batch"}]}}
```

Take a batch's `config_hash` from `/vision/batches` or the state endpoint, pass it here, and you get the markets array — same shape as `/vision/config/{source}` above. The array order is the bit order of your bitmap; the byte-level spec lives in [Bitmap encoding](/docs/bots/bitmap-encoding) (~4 min).

Errors:

| Status | Body | Meaning |
|---|---|---|
| `400` | `{"error": "Invalid config hash — expect 0x-prefixed 32-byte hex"}` | Hash fails the format check |
| `404` | `{"error": "Config not found for hash 0x…", "upstream_status": 404}` | No config known for this hash |
| `502` | `{"error": "Data-node unreachable: …"}` | Upstream down — retry later |

A config hash is the keccak256 of immutable content, so responses are cached aggressively (1 hour, stale-while-revalidate 24 hours). A resolved hash never changes.

```gmseealso
[{"title": "Submit a bitmap", "href": "/docs/developers/vision-api/bitmap"}, {"title": "Join a block", "href": "/docs/bots/join-a-block"}, {"title": "Rounds, results, and history", "href": "/docs/developers/vision-api/history"}]
```

Next: [Submit a bitmap](/docs/developers/vision-api/bitmap) (~3 min)
