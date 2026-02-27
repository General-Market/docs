# Bot Batch Subscription System — Design

## Problem

Bots currently poll `/vision/snapshot` (up to 10K markets) and filter locally for their batch's markets. This wastes bandwidth, doesn't scale for deployment, and has no streaming capability.

## Solution

Hybrid HTTP + WebSocket system on the data-node. WebSocket for live price feed (batch-scoped), HTTP for one-shot history.

## WebSocket — Live Price Feed

**Endpoint:** `ws://data-node/vision/ws`

Single connection per bot. Subscribe/unsubscribe to batch IDs via JSON messages.

### Client → Server

```json
{"subscribe": ["batch_1", "batch_3"]}
{"subscribe": ["batch_5"]}
{"unsubscribe": ["batch_1"]}
```

### Server → Client

```json
{
  "type": "prices",
  "batch_id": "batch_1",
  "ts": "2026-02-26T12:00:00Z",
  "markets": [
    {"id": "bitcoin", "source": "coingecko", "price": "95234.50", "change_pct": "2.3", "volume_24h": "45000000000"}
  ]
}
```

On subscribe, data-node fetches batch market list from issuer (`GET /vision/batches` + config), caches it in-memory (5min TTL). When a collector finishes writing prices, it broadcasts to subscribers watching that batch's source.

### Compression

`permessage-deflate` WebSocket extension (built into protocol, supported by `tokio-tungstenite` and Python `websockets`).

## HTTP — Batch History

**Endpoint:** `GET /vision/batch/{batch_id}/history?days=7`

### Response

```json
{
  "batch_id": "batch_1",
  "source": "coingecko",
  "markets": [
    {
      "id": "bitcoin",
      "symbol": "BTC",
      "prices": [
        {"ts": "2026-02-19T12:00:00Z", "price": "93100.00", "change_pct": "1.1", "volume_24h": "42000000000"},
        {"ts": "2026-02-19T12:05:00Z", "price": "93250.00", "change_pct": "1.2", "volume_24h": "42100000000"}
      ]
    }
  ]
}
```

- Resolves batch → market list (same issuer-backed cache as WS)
- Queries `market_prices` table for those asset IDs over last N days (max 7)
- Bot calls once per batch, caches locally, stays current via WS
- Gzip compressed via `tower-http` `CompressionLayer`

## Data-Node Internals

### Batch Config Cache

- On first subscribe/history request, data-node calls issuer `GET /vision/batches` to resolve batch config + market list
- In-memory cache with 5min TTL, refreshes on miss
- Maps `batch_id → {source, market_ids: [...]}`

### Collector Broadcast

- Each collector already writes prices to DB
- After write, collector publishes to `tokio::sync::broadcast` channel keyed by source
- WS handler listens on relevant source channels (based on subscribed batches), filters to batch's market IDs, sends to client
- No extra DB queries per update — collector already has data in memory

## Bot SDK (Python)

New `framework/feed.py` module. One-line multi-batch subscribe:

```python
feed = VisionFeed(data_node_url="ws://data-node/vision/ws")

# Subscribe + fetch history in one call
feed.subscribe(["batch_1", "batch_3"], history_days=7)

# Latest prices (updated in background thread)
prices = feed.prices("batch_1")
# → {"bitcoin": {"price": 95234.50, "change_pct": 2.3, ...}, ...}

# History (fetched once via HTTP, cached locally)
history = feed.history("batch_1", "bitcoin")
# → [{"ts": ..., "price": ..., "change_pct": ...}, ...]

# Add batches later
feed.subscribe(["batch_5"])

# Cleanup
feed.unsubscribe(["batch_1"])
feed.close()
```

### Internals

- `subscribe()` sends WS message + fires HTTP history call in parallel
- Background thread receives WS messages, updates `self._prices[batch_id][market_id]`
- History stored in `self._history[batch_id][market_id]`, appended from live feed after initial HTTP fetch
- Reconnect with exponential backoff if WS drops, re-subscribes to all active batches

## What Changes / What Stays

### Stays as-is

- `/vision/snapshot` — frontend grid view, source detail pages, market name resolution
- `/vision/snapshot/meta` — frontend source health
- Issuer `/vision/batches` — data-node reads from it to resolve batch configs

### New on data-node

- `ws://data-node/vision/ws` — live price feed, batch-scoped
- `GET /vision/batch/{batch_id}/history?days=7` — one-shot history
- In-memory batch config cache (issuer-backed, 5min TTL)
- `tokio::sync::broadcast` channels per source in collectors

### Changes on bot

- Replace `fetch_markets()` polling with `VisionFeed` class
- New `framework/feed.py` module
- `bot.py` main loop uses `feed.prices(batch_id)` instead of snapshot polling
- Remove `/vision/snapshot` calls from bot

### No changes to

- Frontend
- Issuer
- Smart contracts
- Collectors (just add broadcast call after DB write)
