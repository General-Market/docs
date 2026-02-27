# ITP Orderbook Depth — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a right-expanding orderbook depth drawer to ITP cards, powered by a new data-node endpoint that aggregates per-asset Bitget orderbooks into a unified index-relative orderbook.

**Architecture:** New `GET /itp-orderbook` endpoint in data-node fetches per-asset orderbooks in parallel via `join_all`, aggregates into index-relative price levels (weight-scaled depth), caches 5s. Frontend renders as a right-side drawer that expands on hover with depth bars, spread badge, aggregation selector, and per-asset breakdown.

**Tech Stack:** Rust/Axum (data-node), React/TypeScript/Tailwind (frontend), existing `BitgetReadOnlyClient::get_orderbook()` trait method.

---

### Task 1: Add Bitget client to AppState

**Files:**
- Modify: `data-node/src/api.rs:216-238` (AppState struct)
- Modify: `data-node/src/main.rs` (AppState construction, ~line 780+)

**Step 1: Add `bitget_client` field to AppState**

In `data-node/src/api.rs`, add the import and field:

```rust
// Add to imports at top of file
use common::BitgetReadOnlyClient;

// Add to AppState struct (after batch_engine field):
pub struct AppState {
    // ... existing fields ...
    /// Bitget read-only client for on-demand orderbook fetches
    pub bitget_client: Arc<dyn BitgetReadOnlyClient + Send + Sync>,
}
```

**Step 2: Construct and pass client in main.rs**

In `data-node/src/main.rs`, create the client near the AppState construction (around where `live_cache` is created). Look for where `AppState` is built and add:

```rust
use common::integrations::bitget::{BitgetReadOnlyClientImpl, BitgetReadOnlyConfig};
use common::BitgetReadOnlyClient;

// Near AppState construction:
let bitget_client: Arc<dyn BitgetReadOnlyClient + Send + Sync> = {
    match BitgetReadOnlyConfig::from_env() {
        Ok(config) => match BitgetReadOnlyClientImpl::new(config) {
            Ok(client) => Arc::new(client),
            Err(e) => {
                tracing::warn!(?e, "Failed to create Bitget client for orderbook, using mock");
                Arc::new(common::mocks::bitget_read_only::MockBitgetReadOnlyClient::new())
            }
        },
        Err(e) => {
            tracing::warn!(?e, "No Bitget config for orderbook, using mock");
            Arc::new(common::mocks::bitget_read_only::MockBitgetReadOnlyClient::new())
        }
    }
};

// Add to AppState { ... bitget_client, ... }
```

**Step 3: Verify it compiles**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p data-node 2>&1 | tail -5`
Expected: compiles (possibly warnings, no errors)

**Step 4: Commit**

```bash
git add data-node/src/api.rs data-node/src/main.rs
git commit -m "feat(data-node): add Bitget client to AppState for orderbook fetches"
```

---

### Task 2: Create orderbook aggregator module

**Files:**
- Create: `data-node/src/orderbook_aggregator.rs`
- Modify: `data-node/src/main.rs:1` (add `mod orderbook_aggregator;`)

**Step 1: Create the aggregator module**

Create `data-node/src/orderbook_aggregator.rs`:

```rust
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use serde::Serialize;
use tokio::sync::RwLock;
use tracing::warn;

use common::BitgetReadOnlyClient;

// ── Types ────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct OrderbookLevel {
    pub price: f64,
    pub quantity: f64,
    pub usd_value: f64,
}

#[derive(Clone, Serialize)]
pub struct AssetOrderbookSummary {
    pub symbol: String,
    pub weight_bps: u64,
    pub mid_price: f64,
    pub spread_bps: f64,
    pub bid_depth_usd: f64,
    pub ask_depth_usd: f64,
}

#[derive(Clone, Serialize)]
pub struct AggregatedOrderbook {
    pub bids: Vec<OrderbookLevel>,
    pub asks: Vec<OrderbookLevel>,
    pub mid_price: f64,
    pub spread_bps: f64,
    pub total_bid_depth_usd: f64,
    pub total_ask_depth_usd: f64,
    pub assets_included: usize,
    pub assets_failed: Vec<String>,
    pub per_asset: Vec<AssetOrderbookSummary>,
}

// ── Cache ────────────────────────────────────────────────────────────

struct CacheEntry {
    data: AggregatedOrderbook,
    inserted_at: Instant,
}

pub struct OrderbookCache {
    entries: RwLock<HashMap<String, CacheEntry>>,
    ttl_secs: u64,
}

impl OrderbookCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
            ttl_secs,
        }
    }

    pub async fn get(&self, key: &str) -> Option<AggregatedOrderbook> {
        let entries = self.entries.read().await;
        if let Some(entry) = entries.get(key) {
            if entry.inserted_at.elapsed().as_secs() < self.ttl_secs {
                return Some(entry.data.clone());
            }
        }
        None
    }

    pub async fn set(&self, key: String, data: AggregatedOrderbook) {
        let mut entries = self.entries.write().await;
        entries.insert(key, CacheEntry { data, inserted_at: Instant::now() });
        // Evict stale entries (keep cache bounded)
        entries.retain(|_, v| v.inserted_at.elapsed().as_secs() < self.ttl_secs * 2);
    }
}

// ── Aggregation ──────────────────────────────────────────────────────

/// Asset input for aggregation: symbol on Bitget (e.g. "BTCUSDT"), inventory quantity, weight in bps.
pub struct AssetInput {
    pub symbol: String,
    pub inventory: f64,
    pub weight_bps: u64,
}

/// Fetch orderbooks for all assets in parallel, aggregate into index-relative orderbook.
///
/// Algorithm (from old indexmaker-backend LiveOrderbookCache):
/// 1. Parallel fetch per-asset orderbooks from Bitget
/// 2. Compute per-asset mid price, spread
/// 3. For each asset level, convert to index-relative price:
///    `index_price = index_mid * (asset_price / asset_mid)`
/// 4. Scale USD depth by weight:
///    `usd_value = (asset_price * qty) / weight_fraction`
/// 5. Sort, aggregate within aggregation_bps threshold, truncate to requested levels
pub async fn fetch_and_aggregate(
    client: &Arc<dyn BitgetReadOnlyClient + Send + Sync>,
    assets: &[AssetInput],
    levels: usize,
    aggregation_bps: u64,
) -> AggregatedOrderbook {
    // 1. Parallel fetch all orderbooks (cap concurrency at 20)
    let semaphore = Arc::new(tokio::sync::Semaphore::new(20));
    let futures: Vec<_> = assets
        .iter()
        .map(|asset| {
            let client = Arc::clone(client);
            let symbol = asset.symbol.clone();
            let sem = Arc::clone(&semaphore);
            async move {
                let _permit = sem.acquire().await.unwrap();
                let result = client.get_orderbook(&symbol, 15).await;
                (symbol, result)
            }
        })
        .collect();

    let results = futures_util::future::join_all(futures).await;

    // 2. Build per-asset data
    let mut per_asset_summaries: Vec<AssetOrderbookSummary> = Vec::new();
    let mut assets_failed: Vec<String> = Vec::new();

    // Collect raw levels: (index_relative_price, usd_value, is_bid)
    let mut all_bids: Vec<(f64, f64, f64)> = Vec::new(); // (price, qty, usd)
    let mut all_asks: Vec<(f64, f64, f64)> = Vec::new();

    // First pass: compute weighted mid price for the index
    let mut weighted_mid_sum: f64 = 0.0;
    let mut weight_sum: f64 = 0.0;

    struct AssetBook {
        mid: f64,
        bids: Vec<(f64, f64)>,
        asks: Vec<(f64, f64)>,
        weight_bps: u64,
        inventory: f64,
    }

    let mut asset_books: Vec<AssetBook> = Vec::new();

    for (i, (symbol, result)) in results.iter().enumerate() {
        match result {
            Ok(book) => {
                if book.bids.is_empty() || book.asks.is_empty() {
                    assets_failed.push(symbol.clone());
                    continue;
                }
                let best_bid = book.bids[0].0;
                let best_ask = book.asks[0].0;
                let mid = (best_bid + best_ask) / 2.0;
                if mid <= 0.0 {
                    assets_failed.push(symbol.clone());
                    continue;
                }

                let weight_bps = assets[i].weight_bps;
                let inventory = assets[i].inventory;

                // Contribute to index mid: mid * inventory (NAV contribution)
                weighted_mid_sum += mid * inventory;
                weight_sum += weight_bps as f64;

                let spread_bps = ((best_ask - best_bid) / mid * 10_000.0) as f64;
                let bid_depth: f64 = book.bids.iter().map(|(p, q)| p * q).sum();
                let ask_depth: f64 = book.asks.iter().map(|(p, q)| p * q).sum();

                per_asset_summaries.push(AssetOrderbookSummary {
                    symbol: symbol.clone(),
                    weight_bps,
                    mid_price: mid,
                    spread_bps,
                    bid_depth_usd: bid_depth,
                    ask_depth_usd: ask_depth,
                });

                asset_books.push(AssetBook {
                    mid,
                    bids: book.bids.clone(),
                    asks: book.asks.clone(),
                    weight_bps,
                    inventory,
                });
            }
            Err(e) => {
                warn!(symbol, ?e, "Failed to fetch orderbook");
                assets_failed.push(symbol.clone());
            }
        }
    }

    if asset_books.is_empty() {
        return AggregatedOrderbook {
            bids: vec![],
            asks: vec![],
            mid_price: 0.0,
            spread_bps: 0.0,
            total_bid_depth_usd: 0.0,
            total_ask_depth_usd: 0.0,
            assets_included: 0,
            assets_failed,
            per_asset: per_asset_summaries,
        };
    }

    // Index mid price = NAV = sum(inventory[i] * mid[i]) / 1e18
    let index_mid = weighted_mid_sum / 1e18;

    // 3. Convert all asset levels to index-relative prices
    for ab in &asset_books {
        let weight_frac = ab.weight_bps as f64 / 10_000.0;
        if weight_frac <= 0.0 { continue; }

        for &(price, qty) in &ab.bids {
            let index_price = index_mid * (price / ab.mid);
            let usd = (price * qty) / weight_frac;
            all_bids.push((index_price, qty, usd));
        }

        for &(price, qty) in &ab.asks {
            let index_price = index_mid * (price / ab.mid);
            let usd = (price * qty) / weight_frac;
            all_asks.push((index_price, qty, usd));
        }
    }

    // 4. Sort: bids descending by price, asks ascending
    all_bids.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    all_asks.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    // 5. Aggregate within threshold
    let agg_threshold = aggregation_bps as f64 / 10_000.0;

    let aggregate_levels = |raw: &[(f64, f64, f64)], max_levels: usize| -> Vec<OrderbookLevel> {
        let mut result: Vec<OrderbookLevel> = Vec::new();
        for &(price, qty, usd) in raw {
            if let Some(last) = result.last_mut() {
                let diff = ((price - last.price) / last.price).abs();
                if diff <= agg_threshold {
                    last.quantity += qty;
                    last.usd_value += usd;
                    continue;
                }
            }
            result.push(OrderbookLevel { price, quantity: qty, usd_value: usd });
            if result.len() >= max_levels {
                break;
            }
        }
        result
    };

    let bids = aggregate_levels(&all_bids, levels);
    let asks = aggregate_levels(&all_asks, levels);

    let total_bid_depth: f64 = bids.iter().map(|l| l.usd_value).sum();
    let total_ask_depth: f64 = asks.iter().map(|l| l.usd_value).sum();

    let spread_bps = if index_mid > 0.0 {
        let best_bid = bids.first().map(|l| l.price).unwrap_or(0.0);
        let best_ask = asks.first().map(|l| l.price).unwrap_or(0.0);
        if best_bid > 0.0 {
            (best_ask - best_bid) / index_mid * 10_000.0
        } else {
            0.0
        }
    } else {
        0.0
    };

    AggregatedOrderbook {
        bids,
        asks,
        mid_price: index_mid,
        spread_bps,
        total_bid_depth_usd: total_bid_depth,
        total_ask_depth_usd: total_ask_depth,
        assets_included: asset_books.len(),
        assets_failed,
        per_asset: per_asset_summaries,
    }
}
```

**Step 2: Register module in main.rs**

Add `mod orderbook_aggregator;` to the module declarations at the top of `data-node/src/main.rs` (after `mod liquidity_collector;`).

**Step 3: Verify it compiles**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p data-node 2>&1 | tail -5`
Expected: compiles

**Step 4: Commit**

```bash
git add data-node/src/orderbook_aggregator.rs data-node/src/main.rs
git commit -m "feat(data-node): orderbook aggregator with parallel fetch and index-relative pricing"
```

---

### Task 3: Add `/itp-orderbook` API endpoint

**Files:**
- Modify: `data-node/src/api.rs` (add route + handler, add cache to AppState)
- Modify: `data-node/src/main.rs` (wire OrderbookCache into AppState)

**Step 1: Add OrderbookCache to AppState**

In `data-node/src/api.rs`, add to AppState:

```rust
use crate::orderbook_aggregator::{self, OrderbookCache};

// In AppState struct:
pub orderbook_cache: Arc<OrderbookCache>,
```

**Step 2: Add route registration**

In the router builder (after `.route("/itp-bid-ask", get(itp_bid_ask))`):

```rust
.route("/itp-orderbook", get(itp_orderbook))
```

**Step 3: Add handler**

After the `itp_bid_ask` handler (~line 2381), add:

```rust
// ---- /itp-orderbook ----

#[derive(Deserialize)]
struct ItpOrderbookQuery {
    itp_id: String,
    levels: Option<usize>,
    aggregation_bps: Option<u64>,
}

async fn itp_orderbook(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ItpOrderbookQuery>,
) -> Result<Json<orderbook_aggregator::AggregatedOrderbook>, (StatusCode, Json<ErrorResponse>)> {
    let itp_id = params.itp_id.to_lowercase();
    let levels = params.levels.unwrap_or(15).min(50);
    let aggregation_bps = params.aggregation_bps.unwrap_or(10);

    // Check cache
    let cache_key = format!("{}:{}:{}", itp_id, levels, aggregation_bps);
    if let Some(cached) = state.orderbook_cache.get(&cache_key).await {
        return Ok(Json(cached));
    }

    // Get ITP snapshot (same logic as itp_bid_ask)
    let snapshot = db::query_itp_snapshot_at(&state.pool, &itp_id, Utc::now())
        .await
        .map_err(|e| db_error(e))?;

    let snapshot = match snapshot {
        Some(s) => s,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("No snapshot found for ITP '{}'", itp_id),
                }),
            ));
        }
    };

    if snapshot.assets.len() != snapshot.inventory.len() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Snapshot has mismatched assets/inventory lengths".into(),
            }),
        ));
    }

    // Build asset inputs: map addresses to Bitget symbols, collect inventory + weights
    let total_assets = snapshot.assets.len();
    let mut asset_inputs: Vec<orderbook_aggregator::AssetInput> = Vec::new();

    // Compute weights from inventory (same approach as NAV: weight = inv[i]*price[i] / total)
    // For orderbook we need weight_bps. Use equal weights as approximation since we
    // don't have prices yet (the orderbook fetch will give us prices).
    // Better: use inventory proportions as weight proxy.
    let inventories: Vec<f64> = snapshot.inventory.iter()
        .map(|v| v.parse::<f64>().unwrap_or(0.0))
        .collect();

    // We need actual USD weights. Use live_cache for quick price lookup to compute weights.
    let mut symbols_for_weight: Vec<(usize, String, f64)> = Vec::new(); // (idx, symbol, inventory)
    for (i, asset_addr) in snapshot.assets.iter().enumerate() {
        let inv = inventories[i];
        if inv <= 0.0 { continue; }
        if let Some(pair) = state.symbol_map.get(&asset_addr.to_lowercase()) {
            symbols_for_weight.push((i, pair.clone(), inv));
        }
    }

    // Get prices from live cache for weight computation
    let sym_refs: Vec<&str> = symbols_for_weight.iter().map(|(_, s, _)| s.as_str()).collect();
    let tickers = state.live_cache.get_prices(&sym_refs).await;

    let mut usd_values: Vec<(String, f64, f64)> = Vec::new(); // (symbol, inventory, usd_value)
    let mut total_usd: f64 = 0.0;

    for (_, symbol, inv) in &symbols_for_weight {
        if let Some(ticker) = tickers.get(symbol) {
            let price: f64 = ticker.last_price.parse().unwrap_or(0.0);
            let usd = inv * price;
            total_usd += usd;
            usd_values.push((symbol.clone(), *inv, usd));
        }
    }

    if total_usd <= 0.0 {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                error: "No price data available for ITP assets".into(),
            }),
        ));
    }

    // Compute weight_bps from USD proportions
    // Deduplicate symbols (same symbol can appear multiple times for different addresses)
    let mut symbol_map: HashMap<String, (f64, u64)> = HashMap::new(); // symbol -> (inventory, weight_bps)
    for (symbol, inv, usd) in &usd_values {
        let weight_bps = ((usd / total_usd) * 10_000.0).round() as u64;
        let entry = symbol_map.entry(symbol.clone()).or_insert((0.0, 0));
        entry.0 += inv;
        entry.1 += weight_bps;
    }

    for (symbol, (inv, weight_bps)) in &symbol_map {
        if *weight_bps == 0 { continue; }
        asset_inputs.push(orderbook_aggregator::AssetInput {
            symbol: symbol.clone(),
            inventory: *inv,
            weight_bps: *weight_bps,
        });
    }

    if asset_inputs.is_empty() {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                error: "No tradeable assets found for ITP".into(),
            }),
        ));
    }

    // Fetch and aggregate
    let result = orderbook_aggregator::fetch_and_aggregate(
        &state.bitget_client,
        &asset_inputs,
        levels,
        aggregation_bps,
    ).await;

    // Cache result
    state.orderbook_cache.set(cache_key, result.clone()).await;

    Ok(Json(result))
}
```

**Step 4: Wire OrderbookCache in main.rs**

In AppState construction in `main.rs`, add:

```rust
orderbook_cache: Arc::new(orderbook_aggregator::OrderbookCache::new(5)),
```

**Step 5: Verify it compiles**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p data-node 2>&1 | tail -5`
Expected: compiles

**Step 6: Commit**

```bash
git add data-node/src/api.rs data-node/src/main.rs
git commit -m "feat(data-node): /itp-orderbook endpoint with aggregated depth"
```

---

### Task 4: Create `useItpOrderbook` frontend hook

**Files:**
- Create: `frontend/hooks/useItpOrderbook.ts`

**Step 1: Create the hook**

Create `frontend/hooks/useItpOrderbook.ts`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

export interface OrderbookLevel {
  price: number
  quantity: number
  usd_value: number
}

export interface AssetOrderbookSummary {
  symbol: string
  weight_bps: number
  mid_price: number
  spread_bps: number
  bid_depth_usd: number
  ask_depth_usd: number
}

export interface OrderbookData {
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  mid_price: number
  spread_bps: number
  total_bid_depth_usd: number
  total_ask_depth_usd: number
  assets_included: number
  assets_failed: string[]
  per_asset: AssetOrderbookSummary[]
}

interface UseItpOrderbookReturn {
  data: OrderbookData | null
  isLoading: boolean
  error: string | null
  aggregationBps: number
  setAggregationBps: (bps: number) => void
  fetch: () => void
  cancel: () => void
}

export function useItpOrderbook(
  itpId: string | undefined,
  enabled: boolean,
  levels: number = 15,
): UseItpOrderbookReturn {
  const [data, setData] = useState<OrderbookData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aggregationBps, setAggregationBps] = useState(10)
  const abortRef = useRef<AbortController | null>(null)
  const cacheRef = useRef<Map<string, { data: OrderbookData; ts: number }>>(new Map())

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const fetchOrderbook = useCallback(async () => {
    if (!itpId) return

    // Check client cache (5s TTL)
    const cacheKey = `${itpId}:${levels}:${aggregationBps}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.ts < 5000) {
      setData(cached.data)
      return
    }

    cancel()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `${DATA_NODE_URL}/itp-orderbook?itp_id=${itpId}&levels=${levels}&aggregation_bps=${aggregationBps}`,
        { signal: controller.signal },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const result: OrderbookData = await res.json()
      setData(result)
      cacheRef.current.set(cacheKey, { data: result, ts: Date.now() })
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Failed to fetch orderbook')
    } finally {
      setIsLoading(false)
    }
  }, [itpId, levels, aggregationBps, cancel])

  // Auto-fetch when enabled (with 200ms debounce)
  useEffect(() => {
    if (!enabled || !itpId) {
      cancel()
      return
    }

    const timer = setTimeout(() => {
      fetchOrderbook()
    }, 200)

    return () => {
      clearTimeout(timer)
      cancel()
    }
  }, [enabled, itpId, fetchOrderbook, cancel])

  // Cleanup on unmount
  useEffect(() => cancel, [cancel])

  return {
    data,
    isLoading,
    error,
    aggregationBps,
    setAggregationBps,
    fetch: fetchOrderbook,
    cancel,
  }
}
```

**Step 2: Commit**

```bash
git add frontend/hooks/useItpOrderbook.ts
git commit -m "feat(frontend): useItpOrderbook hook with debounce and client cache"
```

---

### Task 5: Create `OrderbookDrawer` component

**Files:**
- Create: `frontend/components/domain/OrderbookDrawer.tsx`

**Step 1: Create the component**

Create `frontend/components/domain/OrderbookDrawer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { OrderbookData, OrderbookLevel, AssetOrderbookSummary } from '@/hooks/useItpOrderbook'

const AGGREGATION_OPTIONS = [
  { label: 'Raw', value: 0 },
  { label: '0.01%', value: 1 },
  { label: '0.02%', value: 2 },
  { label: '0.05%', value: 5 },
  { label: '0.1%', value: 10 },
  { label: '0.25%', value: 25 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
  { label: '2%', value: 200 },
  { label: '5%', value: 500 },
]

interface OrderbookDrawerProps {
  data: OrderbookData | null
  isLoading: boolean
  error: string | null
  aggregationBps: number
  onAggregationChange: (bps: number) => void
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  if (price >= 0.01) return price.toFixed(6)
  return price.toFixed(8)
}

function SpreadBadge({ bps }: { bps: number }) {
  const color = bps < 10 ? 'text-green-600 bg-green-50' : bps < 50 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
  return (
    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {bps.toFixed(1)} bps
    </span>
  )
}

function OrderbookRow({ level, maxDepth, side }: { level: OrderbookLevel; maxDepth: number; side: 'bid' | 'ask' }) {
  const barWidth = maxDepth > 0 ? (level.usd_value / maxDepth) * 100 : 0
  const barColor = side === 'bid' ? 'bg-green-500/10' : 'bg-red-500/10'
  const textColor = side === 'bid' ? 'text-green-600' : 'text-red-600'

  return (
    <div className="relative flex items-center text-[10px] font-mono h-[18px] px-1.5">
      <div
        className={`absolute inset-y-0 ${side === 'bid' ? 'left-0' : 'right-0'} ${barColor}`}
        style={{ width: `${barWidth}%` }}
      />
      <span className={`relative z-10 w-[45%] ${textColor}`}>{formatPrice(level.price)}</span>
      <span className="relative z-10 w-[25%] text-right text-gray-500">{level.quantity.toFixed(4)}</span>
      <span className="relative z-10 w-[30%] text-right text-gray-700 font-medium">{formatUsd(level.usd_value)}</span>
    </div>
  )
}

export function OrderbookDrawer({ data, isLoading, error, aggregationBps, onAggregationChange }: OrderbookDrawerProps) {
  const [showAssets, setShowAssets] = useState(false)

  if (isLoading && !data) {
    return (
      <div className="w-[280px] flex items-center justify-center text-[11px] text-gray-400">
        Loading depth...
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-[280px] flex items-center justify-center text-[11px] text-red-400 px-3">
        {error}
      </div>
    )
  }

  if (!data || (data.bids.length === 0 && data.asks.length === 0)) {
    return (
      <div className="w-[280px] flex items-center justify-center text-[11px] text-gray-400">
        No depth data
      </div>
    )
  }

  const maxDepth = Math.max(
    ...data.bids.map(l => l.usd_value),
    ...data.asks.map(l => l.usd_value),
  )

  return (
    <div className="w-[280px] border-l border-border-light bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-border-light flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-800">Depth</span>
          <SpreadBadge bps={data.spread_bps} />
        </div>
        <select
          value={aggregationBps}
          onChange={(e) => onAggregationChange(Number(e.target.value))}
          className="text-[10px] bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-gray-600 cursor-pointer"
        >
          {AGGREGATION_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Mid price */}
      <div className="px-2 py-1 bg-gray-50 border-b border-border-light text-center">
        <span className="text-[12px] font-bold font-mono text-gray-900">${formatPrice(data.mid_price)}</span>
        {isLoading && <span className="ml-1 text-[9px] text-gray-400">updating...</span>}
      </div>

      {/* Column headers */}
      <div className="flex items-center text-[9px] uppercase tracking-wider text-gray-400 font-semibold px-1.5 py-0.5 border-b border-border-light">
        <span className="w-[45%]">Price</span>
        <span className="w-[25%] text-right">Size</span>
        <span className="w-[30%] text-right">Total</span>
      </div>

      {/* Asks (reversed — highest to lowest) */}
      <div className="flex flex-col-reverse">
        {data.asks.map((level, i) => (
          <OrderbookRow key={`ask-${i}`} level={level} maxDepth={maxDepth} side="ask" />
        ))}
      </div>

      {/* Spread line */}
      <div className="px-2 py-0.5 border-y border-dashed border-gray-200 text-center">
        <span className="text-[9px] text-gray-400 font-mono">
          spread {data.spread_bps.toFixed(1)} bps
        </span>
      </div>

      {/* Bids */}
      <div>
        {data.bids.map((level, i) => (
          <OrderbookRow key={`bid-${i}`} level={level} maxDepth={maxDepth} side="bid" />
        ))}
      </div>

      {/* Depth summary */}
      <div className="px-2 py-1 border-t border-border-light flex justify-between text-[9px] text-gray-500 font-mono">
        <span className="text-green-600">Bid {formatUsd(data.total_bid_depth_usd)}</span>
        <span className="text-gray-400">{data.assets_included}/{data.assets_included + data.assets_failed.length}</span>
        <span className="text-red-600">Ask {formatUsd(data.total_ask_depth_usd)}</span>
      </div>

      {/* Per-asset breakdown toggle */}
      <button
        onClick={() => setShowAssets(!showAssets)}
        className="px-2 py-1 border-t border-border-light text-[9px] text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors text-left"
      >
        {showAssets ? '▾ Hide assets' : '▸ Show assets'} ({data.per_asset.length})
      </button>

      {showAssets && (
        <div className="border-t border-border-light max-h-[200px] overflow-y-auto">
          {data.per_asset
            .sort((a, b) => b.weight_bps - a.weight_bps)
            .map(asset => (
              <AssetRow key={asset.symbol} asset={asset} />
            ))}
        </div>
      )}
    </div>
  )
}

function AssetRow({ asset }: { asset: AssetOrderbookSummary }) {
  const spreadColor = asset.spread_bps < 10 ? 'text-green-600' : asset.spread_bps < 50 ? 'text-yellow-600' : 'text-red-600'
  return (
    <div className="flex items-center justify-between px-2 py-0.5 text-[9px] font-mono hover:bg-gray-50">
      <div className="flex items-center gap-1">
        <span className="text-gray-800 font-medium w-[60px] truncate">{asset.symbol.replace('USDT', '')}</span>
        <span className="text-gray-400">{(asset.weight_bps / 100).toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={spreadColor}>{asset.spread_bps.toFixed(0)}bp</span>
        <span className="text-gray-500 w-[50px] text-right">{formatUsd(asset.bid_depth_usd + asset.ask_depth_usd)}</span>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/domain/OrderbookDrawer.tsx
git commit -m "feat(frontend): OrderbookDrawer component with depth bars, spread, aggregation, per-asset breakdown"
```

---

### Task 6: Integrate drawer into ItpCard with right-expand on hover

**Files:**
- Modify: `frontend/components/domain/ItpListing.tsx`

**Step 1: Add imports**

At the top of `ItpListing.tsx` (after existing imports):

```typescript
import { useItpOrderbook } from '@/hooks/useItpOrderbook'
import { OrderbookDrawer } from './OrderbookDrawer'
```

**Step 2: Add hover state and hook to ItpCard**

Inside the `ItpCard` function (after the existing state declarations around line 346-351), add:

```typescript
const [isHovered, setIsHovered] = useState(false)
const { data: orderbookData, isLoading: orderbookLoading, error: orderbookError, aggregationBps, setAggregationBps } = useItpOrderbook(
  itp.itpId ?? undefined,
  isHovered && isActive,
)
```

**Step 3: Wrap the card in a hover container**

Replace the card's root `<div>` (line ~494):

From:
```tsx
<div id={itp.itpId ? `itp-card-${itp.itpId}` : undefined} className="bg-white border-r border-b border-border-light overflow-hidden">
```

To:
```tsx
<div
  id={itp.itpId ? `itp-card-${itp.itpId}` : undefined}
  className="relative bg-white border-r border-b border-border-light overflow-visible group"
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>
  <div className="flex">
    <div className="flex-1 min-w-0 overflow-hidden">
```

**Step 4: Add drawer after the card content, close the flex wrapper**

Before the closing `</div>` of the card root (line ~733 area), close the inner flex div and add the drawer:

```tsx
    </div>{/* end flex-1 inner content */}

    {/* Orderbook drawer — expands right on hover */}
    <div className={`transition-all duration-200 ease-out overflow-hidden ${isHovered && isActive ? 'w-[280px] opacity-100' : 'w-0 opacity-0'}`}>
      <OrderbookDrawer
        data={orderbookData}
        isLoading={orderbookLoading}
        error={orderbookError}
        aggregationBps={aggregationBps}
        onAggregationChange={setAggregationBps}
      />
    </div>
  </div>{/* end flex container */}
```

**Step 5: Adjust grid to allow overflow**

In the grid container (line ~266), change:

From:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-border-light">
```

To:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-border-light relative">
```

**Step 6: Make hovered card use absolute positioning for the drawer**

Actually, the simpler approach: make the drawer absolutely positioned so it doesn't displace neighbors. Update the drawer wrapper in Step 4:

Instead of inline flex, use absolute positioning:

```tsx
    </div>{/* end card content */}

    {/* Orderbook drawer — absolutely positioned right of card on hover */}
    {isHovered && isActive && (
      <div className="absolute top-0 left-full z-50 h-full animate-in slide-in-from-left-2 duration-200">
        <OrderbookDrawer
          data={orderbookData}
          isLoading={orderbookLoading}
          error={orderbookError}
          aggregationBps={aggregationBps}
          onAggregationChange={setAggregationBps}
        />
      </div>
    )}
  </div>{/* end flex container (remove if using absolute) */}
```

Note: With absolute positioning, the flex wrapper from Step 3 is unnecessary. Keep the card structure simpler:

```tsx
<div
  id={itp.itpId ? `itp-card-${itp.itpId}` : undefined}
  className="relative bg-white border-r border-b border-border-light overflow-visible"
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>
  {/* ... existing card content unchanged ... */}

  {/* Orderbook drawer */}
  {isHovered && isActive && (
    <div className="absolute top-0 left-full z-50 h-full shadow-lg">
      <OrderbookDrawer
        data={orderbookData}
        isLoading={orderbookLoading}
        error={orderbookError}
        aggregationBps={aggregationBps}
        onAggregationChange={setAggregationBps}
      />
    </div>
  )}
</div>
```

**Step 7: Verify frontend compiles**

Run: `cd /Users/maxguillabert/Downloads/index/frontend && npx next build 2>&1 | tail -10`
Expected: compiles (or use `npx tsc --noEmit`)

**Step 8: Commit**

```bash
git add frontend/components/domain/ItpListing.tsx
git commit -m "feat(frontend): integrate OrderbookDrawer with ITP cards — right-expand on hover"
```

---

### Task 7: Manual integration test

**Step 1: Start data-node**

Ensure data-node is running with Bitget config available.

**Step 2: Test endpoint directly**

```bash
curl -s "http://localhost:8200/itp-orderbook?itp_id=<YOUR_ITP_ID>&levels=10&aggregation_bps=10" | jq '.mid_price, .spread_bps, .assets_included, (.bids | length), (.asks | length)'
```

Expected: mid_price > 0, bids/asks arrays with levels.

**Step 3: Test frontend**

Start frontend, navigate to the ITP listing page. Hover over an active ITP card. The drawer should appear to the right with:
- Depth bars (green bids, red asks)
- Mid price centered
- Spread badge color-coded
- Aggregation dropdown functional
- Per-asset breakdown expandable
- 200ms debounce before fetch on hover
- Drawer disappears on unhover

**Step 4: Test edge cases**
- Hover quickly across multiple cards (should cancel previous requests)
- Hover a pending/inactive ITP (should not show drawer)
- Test aggregation selector changes (should re-fetch with new bps)

**Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: integration test fixes for orderbook drawer"
```
