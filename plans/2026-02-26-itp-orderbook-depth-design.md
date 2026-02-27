# ITP Orderbook Depth System

## Overview

Add real-time orderbook depth visualization to ITP cards. When a user hovers an ITP card, it expands to the right revealing a drawer with aggregated orderbook depth for all underlying assets.

Ported from the old `indexmaker_frontend` + `indexmaker-backend` system, adapted to current data-node + frontend architecture.

## Architecture

```
User hovers ITP card
  → Frontend calls GET /itp-orderbook?itp_id=X&levels=15&aggregation_bps=10
  → Data-node reads ITP inventory (symbols + quantities from contract/cache)
  → join_all: parallel Bitget HTTP get_orderbook(symbol, 15) for each asset
  → Aggregate into index-relative orderbook
  → Short-lived in-memory cache (5s TTL per itp_id)
  → Return aggregated OrderbookData
  → Frontend renders right-side drawer on card
```

### What stays unchanged
- `run_fast_poller` + `LiveTickerCache` — untouched, keeps providing bid/ask/last for all symbols
- `/fast-prices`, `/itp-bid-ask` endpoints — untouched
- Buy/Sell modals — no orderbook inside them
- SSE streams — untouched

## Data-Node: New Endpoint

### `GET /itp-orderbook`

**Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `itp_id` | String | required | ITP identifier |
| `levels` | usize | 15 | Number of aggregated price levels per side |
| `aggregation_bps` | u64 | 10 | Price level grouping threshold in basis points |

**Flow:**
1. Read ITP inventory from contract cache → get `Vec<(symbol, quantity, weight_bps)>`
2. `futures::join_all` — parallel `client.get_orderbook(symbol, 15)` for each asset (uses existing Bitget client method from `liquidity_collector.rs`)
3. Aggregate using index-relative pricing algorithm (ported from old `live_orderbook_cache.rs`)
4. Cache result in `HashMap<String, (Instant, OrderbookData)>` with 5s TTL
5. Return JSON response

**Aggregation algorithm** (from old system):
- For each asset, convert price levels to index-relative prices: `index_price = index_mid * (asset_price / asset_mid)`
- Scale USD depth by weight: `usd_value = (asset_price * qty) / weight_pct` (if asset is 10% weight and has $1M depth, that supports $10M of index trades)
- Sort and merge levels within `aggregation_bps` threshold
- Truncate to requested number of levels

**Response:**
```rust
struct OrderbookResponse {
    bids: Vec<OrderbookLevel>,
    asks: Vec<OrderbookLevel>,
    mid_price: f64,
    spread_bps: f64,
    total_bid_depth_usd: f64,
    total_ask_depth_usd: f64,
    assets_included: usize,
    assets_failed: Vec<String>,
    per_asset: Vec<AssetOrderbookSummary>,
    cache_age_ms: u64,
}

struct OrderbookLevel {
    price: f64,
    quantity: f64,
    usd_value: f64,
}

struct AssetOrderbookSummary {
    symbol: String,
    weight_bps: u64,
    mid_price: f64,
    spread_bps: f64,
    bid_depth_usd: f64,
    ask_depth_usd: f64,
}
```

## Frontend: New Components

### `useItpOrderbook` hook
- Fetches `GET /itp-orderbook?itp_id=X&levels=15&aggregation_bps=10`
- Triggered on hover with 200ms debounce (prevents fetch on accidental mouse-over)
- Cancels request on unhover (AbortController)
- Client-side cache: 5s TTL per itp_id
- Exposes: `data`, `isLoading`, `error`, `aggregationBps`, `setAggregationBps`

### `OrderbookDrawer` component
Right-side drawer that expands from the ITP card on hover. Full feature set:

- **Depth bars**: green bids (left-aligned), red asks (right-aligned), width proportional to USD depth
- **Mid price header**: current index mid price
- **Spread badge**: color-coded (green < 10bps, yellow < 50bps, red >= 50bps)
- **Aggregation selector**: dropdown — Raw, 0.01%, 0.02%, 0.05%, 0.1%, 0.25%, 0.5%, 1%, 2%, 5%
- **Per-asset breakdown**: collapsible panel showing per-asset symbol, weight%, mid price, spread, depth
- **Depth summary footer**: total bid/ask depth in USD

Each row shows: Price | Size (qty) | Total (USD value)

### Card integration in `ItpListing.tsx`
- On hover → card width expands to the right, `OrderbookDrawer` renders in the new space
- On unhover → collapse back with 300ms delay (prevents flicker on re-entry)
- Card uses CSS transition for smooth expand/collapse
- Grid layout must accommodate expanded cards without displacing neighbors (use absolute positioning or CSS grid span)

## Files to Create/Modify

### Data-Node (Rust)
| File | Action | Description |
|------|--------|-------------|
| `data-node/src/orderbook_aggregator.rs` | Create | Aggregation logic: parallel fetch, index-relative pricing, level merging |
| `data-node/src/api.rs` | Modify | Add `/itp-orderbook` endpoint + handler |
| `data-node/src/main.rs` | Modify | Wire up orderbook cache in AppState |

### Frontend (TypeScript/React)
| File | Action | Description |
|------|--------|-------------|
| `frontend/hooks/useItpOrderbook.ts` | Create | Hook for fetching + caching orderbook data |
| `frontend/components/domain/OrderbookDrawer.tsx` | Create | Orderbook depth visualization component |
| `frontend/components/domain/ItpListing.tsx` | Modify | Add hover expand + OrderbookDrawer integration |

## Edge Cases
- **Asset with no Bitget pair**: skip, report in `assets_failed`
- **Stale cache**: if cache is >5s old, re-fetch; serve stale while fetching (stale-while-revalidate)
- **Empty orderbook**: if an asset returns empty bids/asks, exclude from aggregation
- **Rate limiting**: Bitget REST allows ~20 req/s; 100 parallel fetches may hit limits. Add semaphore with concurrency cap of 20.
- **Hover spam**: 200ms debounce + client cache prevents excessive requests
