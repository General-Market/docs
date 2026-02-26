# Bot Batch Subscription Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace bot polling of `/vision/snapshot` with a WebSocket live feed + HTTP history endpoint, both scoped per batch.

**Architecture:** Data-node gets a `tokio::sync::broadcast` channel per source. After each collector sync, prices are broadcast. A new WebSocket handler at `/vision/ws` manages per-bot subscriptions (batch_id → source → market filter). A new HTTP endpoint `/vision/batch/{id}/history` serves 7-day price history. Bot gets a new `VisionFeed` Python class.

**Tech Stack:** Rust (axum WebSocket upgrade, tokio broadcast channels), Python (websockets library), gzip (tower-http CompressionLayer)

---

### Task 1: Price Broadcast Channel

**Files:**
- Create: `data-node/src/market_data/broadcast.rs`
- Modify: `data-node/src/market_data/mod.rs`
- Modify: `data-node/src/api.rs:219-245` (AppState)

**Step 1: Create the broadcast module**

Create `data-node/src/market_data/broadcast.rs`:

```rust
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// A single price update from a collector
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceBroadcast {
    pub source: String,
    pub asset_id: String,
    pub symbol: String,
    pub value: Decimal,
    pub change_pct: Option<Decimal>,
    pub volume_24h: Option<Decimal>,
    pub market_cap: Option<Decimal>,
    pub fetched_at: DateTime<Utc>,
}

/// Batch of price updates from a single collector sync
#[derive(Debug, Clone)]
pub struct SourcePriceBatch {
    pub source: String,
    pub prices: Vec<PriceBroadcast>,
    pub timestamp: DateTime<Utc>,
}

/// Global broadcast hub — one sender per source
pub struct PriceBroadcastHub {
    senders: RwLock<HashMap<String, broadcast::Sender<Arc<SourcePriceBatch>>>>,
}

impl PriceBroadcastHub {
    pub fn new() -> Self {
        Self {
            senders: RwLock::new(HashMap::new()),
        }
    }

    /// Get or create a broadcast channel for a source (capacity 16 — recent syncs only)
    pub async fn sender(&self, source: &str) -> broadcast::Sender<Arc<SourcePriceBatch>> {
        {
            let senders = self.senders.read().await;
            if let Some(tx) = senders.get(source) {
                return tx.clone();
            }
        }
        let mut senders = self.senders.write().await;
        senders
            .entry(source.to_string())
            .or_insert_with(|| broadcast::channel(16).0)
            .clone()
    }

    /// Subscribe to a source's price updates
    pub async fn subscribe(&self, source: &str) -> broadcast::Receiver<Arc<SourcePriceBatch>> {
        self.sender(source).await.subscribe()
    }
}
```

**Step 2: Export from mod.rs**

In `data-node/src/market_data/mod.rs`, add:
```rust
pub mod broadcast;
```

**Step 3: Add to AppState**

In `data-node/src/api.rs`, add field to `AppState`:
```rust
pub struct AppState {
    // ... existing fields ...
    pub price_broadcast: Arc<crate::market_data::broadcast::PriceBroadcastHub>,
}
```

Update the AppState construction in `data-node/src/main.rs` to include:
```rust
price_broadcast: Arc::new(crate::market_data::broadcast::PriceBroadcastHub::new()),
```

**Step 4: Run and verify it compiles**

Run: `cd data-node && cargo check 2>&1 | head -30`
Expected: Compiles (broadcast hub is unused but constructed)

**Step 5: Commit**

```bash
git add data-node/src/market_data/broadcast.rs
git add -u data-node/src/market_data/mod.rs data-node/src/api.rs data-node/src/main.rs
git commit -m "feat(data-node): add PriceBroadcastHub for per-source price streaming"
```

---

### Task 2: Wire Broadcast into Sync Engines

**Files:**
- Modify: `data-node/src/market_data/sync_engine.rs`
- Modify: `data-node/src/market_data/scheduled_sync_engine.rs`
- Modify: `data-node/src/market_data/traits.rs` (if needed for PriceUpdate access)

**Step 1: Add broadcast sender to SyncEngine**

In `data-node/src/market_data/sync_engine.rs`, add a broadcast sender field:

```rust
use super::broadcast::{PriceBroadcast, PriceBroadcastHub, SourcePriceBatch};
use std::sync::Arc;

pub struct SyncEngine {
    pool: PgPool,
    source: Box<dyn MarketDataSource>,
    rate_limiter: SlidingWindowRateLimiter,
    sync_count: AtomicU64,
    retention_days: i64,
    broadcast_hub: Arc<PriceBroadcastHub>,
}
```

Update `SyncEngine::new()` to accept `broadcast_hub: Arc<PriceBroadcastHub>` and store it.

**Step 2: Broadcast after sync_prices**

In `SyncEngine::sync_prices()`, after the DB insertion loop (after line 325 `}` closing the `for price in &prices` loop), before the final `Ok(...)`:

```rust
// Broadcast updated prices to WebSocket subscribers
if updated > 0 {
    let batch = Arc::new(SourcePriceBatch {
        source: source_id.to_string(),
        prices: prices.iter().map(|p| PriceBroadcast {
            source: source_id.to_string(),
            asset_id: p.asset_id.clone(),
            symbol: p.symbol.clone(),
            value: p.value,
            change_pct: p.change_pct,
            volume_24h: p.volume_24h,
            market_cap: p.market_cap,
            fetched_at: p.fetched_at,
        }).collect(),
        timestamp: Utc::now(),
    });
    let tx = self.broadcast_hub.sender(source_id).await;
    let _ = tx.send(batch); // ignore error if no subscribers
}
```

**Step 3: Same for ScheduledSyncEngine**

Apply identical changes to `data-node/src/market_data/scheduled_sync_engine.rs`:
- Add `broadcast_hub` field
- Update constructor
- Add broadcast after sync_prices DB loop

**Step 4: Update all SyncEngine/ScheduledSyncEngine construction sites in main.rs**

Find all places in `data-node/src/main.rs` where `SyncEngine::new(pool, source)` or `ScheduledSyncEngine::new(pool, source)` is called. Pass `broadcast_hub.clone()` as the third argument.

Search for: `SyncEngine::new(` and `ScheduledSyncEngine::new(` in main.rs.

**Step 5: Run and verify it compiles**

Run: `cd data-node && cargo check 2>&1 | head -30`
Expected: Compiles cleanly

**Step 6: Commit**

```bash
git add -u data-node/src/market_data/sync_engine.rs data-node/src/market_data/scheduled_sync_engine.rs data-node/src/main.rs
git commit -m "feat(data-node): broadcast price updates after each collector sync"
```

---

### Task 3: Batch Config Cache

**Files:**
- Create: `data-node/src/vision_batch_cache.rs`

The WS handler and history endpoint need to resolve `batch_id → {source, market_ids}`. This module fetches from the issuer and caches.

**Step 1: Create the cache module**

Create `data-node/src/vision_batch_cache.rs`:

```rust
use anyhow::Result;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub struct BatchMarketInfo {
    pub source: String,
    pub market_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct BatchSummary {
    id: u64,
    source_id: String,
    config_hash: String,
}

#[derive(Debug, Deserialize)]
struct BatchesResponse {
    batches: Vec<BatchSummary>,
}

#[derive(Debug, Deserialize)]
struct BatchConfigMarket {
    asset_id: String,
}

#[derive(Debug, Deserialize)]
struct BatchConfigResponse {
    markets: Vec<BatchConfigMarket>,
}

pub struct VisionBatchCache {
    issuer_url: String,
    cache: RwLock<HashMap<u64, BatchMarketInfo>>,
    last_refresh: RwLock<Option<chrono::DateTime<chrono::Utc>>>,
    client: reqwest::Client,
}

impl VisionBatchCache {
    pub fn new(issuer_url: String) -> Self {
        Self {
            issuer_url,
            cache: RwLock::new(HashMap::new()),
            last_refresh: RwLock::new(None),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap(),
        }
    }

    /// Get batch info, refreshing cache if older than 5 minutes or missing
    pub async fn get(&self, batch_id: u64) -> Result<BatchMarketInfo> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(info) = cache.get(&batch_id) {
                let last = self.last_refresh.read().await;
                if let Some(ts) = *last {
                    if (chrono::Utc::now() - ts).num_seconds() < 300 {
                        return Ok(info.clone());
                    }
                }
            }
        }

        // Refresh from issuer
        self.refresh().await?;

        let cache = self.cache.read().await;
        cache
            .get(&batch_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("batch {} not found on issuer", batch_id))
    }

    /// Refresh all batches from issuer
    async fn refresh(&self) -> Result<()> {
        let url = format!("{}/vision/batches", self.issuer_url);
        let resp: BatchesResponse = self.client.get(&url).send().await?.json().await?;

        let mut new_cache = HashMap::new();
        for batch in &resp.batches {
            // Fetch config to get market_ids
            let config_url = format!(
                "{}/batches/config/{}",
                self.issuer_url.replace("/vision", ""),
                batch.config_hash
            );
            match self.client.get(&config_url).send().await {
                Ok(r) if r.status().is_success() => {
                    if let Ok(config) = r.json::<BatchConfigResponse>().await {
                        new_cache.insert(
                            batch.id,
                            BatchMarketInfo {
                                source: batch.source_id.clone(),
                                market_ids: config.markets.iter().map(|m| m.asset_id.clone()).collect(),
                            },
                        );
                    }
                }
                _ => {
                    warn!("Failed to fetch config for batch {} (hash: {})", batch.id, batch.config_hash);
                }
            }
        }

        info!("Refreshed vision batch cache: {} batches", new_cache.len());
        *self.cache.write().await = new_cache;
        *self.last_refresh.write().await = Some(chrono::Utc::now());
        Ok(())
    }
}
```

**Step 2: Add to AppState and mod**

In `data-node/src/main.rs`, add `mod vision_batch_cache;` and construct it in AppState.

In `data-node/src/api.rs` AppState:
```rust
pub vision_batch_cache: Arc<crate::vision_batch_cache::VisionBatchCache>,
```

Construction requires the issuer URL — read from env `ISSUER_URL` or CLI arg.

**Step 3: Run and verify it compiles**

Run: `cd data-node && cargo check 2>&1 | head -30`

**Step 4: Commit**

```bash
git add data-node/src/vision_batch_cache.rs
git add -u data-node/src/main.rs data-node/src/api.rs
git commit -m "feat(data-node): batch config cache backed by issuer API"
```

---

### Task 4: HTTP Batch History Endpoint

**Files:**
- Modify: `data-node/src/vision_api.rs`
- Modify: `data-node/src/api.rs` (add route)

**Step 1: Add the history handler**

In `data-node/src/vision_api.rs`, add:

```rust
#[derive(Deserialize)]
pub struct BatchHistoryQuery {
    pub days: Option<i64>,
}

pub async fn batch_history(
    State(state): State<Arc<AppState>>,
    Path(batch_id): Path<u64>,
    Query(params): Query<BatchHistoryQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let days = params.days.unwrap_or(7).min(7);
    let cutoff = Utc::now() - chrono::Duration::days(days);

    // Resolve batch → source + market_ids
    let batch_info = state
        .vision_batch_cache
        .get(batch_id)
        .await
        .map_err(|e| {
            (StatusCode::NOT_FOUND, Json(ErrorResponse { error: e.to_string() }))
        })?;

    // Query price history for all markets in the batch
    let rows: Vec<(String, String, Decimal, Option<Decimal>, Option<Decimal>, Option<Decimal>, DateTime<Utc>)> =
        sqlx::query_as(
            r#"
            SELECT asset_id, symbol, value, change_pct, volume_24h, market_cap, fetched_at
            FROM market_prices
            WHERE source = $1
              AND asset_id = ANY($2)
              AND fetched_at >= $3
            ORDER BY asset_id, fetched_at ASC
            "#,
        )
        .bind(&batch_info.source)
        .bind(&batch_info.market_ids)
        .bind(cutoff)
        .fetch_all(&state.pool)
        .await
        .map_err(internal_error)?;

    // Group by asset_id
    let mut markets: HashMap<String, serde_json::Value> = HashMap::new();
    for (asset_id, symbol, value, change_pct, volume_24h, market_cap, fetched_at) in rows {
        let entry = markets.entry(asset_id.clone()).or_insert_with(|| {
            serde_json::json!({
                "id": asset_id,
                "symbol": symbol,
                "prices": []
            })
        });
        if let Some(prices) = entry["prices"].as_array_mut() {
            prices.push(serde_json::json!({
                "ts": fetched_at,
                "price": value.to_string(),
                "changePct": change_pct.map(|v| v.to_string()),
                "volume24h": volume_24h.map(|v| v.to_string()),
            }));
        }
    }

    Ok(Json(serde_json::json!({
        "batchId": batch_id,
        "source": batch_info.source,
        "markets": markets.into_values().collect::<Vec<_>>(),
    })))
}
```

**Step 2: Register the route**

In `data-node/src/api.rs`, add after the vision routes (~line 370):
```rust
.route("/vision/batch/:batch_id/history", get(crate::vision_api::batch_history))
```

**Step 3: Add tower-http compression**

In `data-node/Cargo.toml`, change:
```toml
tower-http = { version = "0.5", features = ["cors", "compression-gzip"] }
```

In `data-node/src/api.rs` router function, add compression layer:
```rust
use tower_http::compression::CompressionLayer;

// ... in router() ...
.layer(CompressionLayer::new())
.layer(cors)
```

**Step 4: Run and verify it compiles**

Run: `cd data-node && cargo check 2>&1 | head -30`

**Step 5: Commit**

```bash
git add -u data-node/src/vision_api.rs data-node/src/api.rs data-node/Cargo.toml
git commit -m "feat(data-node): HTTP batch history endpoint with gzip compression"
```

---

### Task 5: WebSocket Handler

**Files:**
- Create: `data-node/src/vision_ws.rs`
- Modify: `data-node/src/api.rs` (add route)
- Modify: `data-node/src/main.rs` (add mod)

**Step 1: Create the WebSocket handler module**

Create `data-node/src/vision_ws.rs`:

```rust
use axum::{
    extract::{State, ws::{Message, WebSocket, WebSocketUpgrade}},
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{info, warn, debug};

use crate::api::AppState;
use crate::market_data::broadcast::SourcePriceBatch;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientMessage {
    subscribe: Option<Vec<u64>>,
    unsubscribe: Option<Vec<u64>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PriceMessage {
    r#type: &'static str,
    batch_id: u64,
    ts: String,
    markets: Vec<MarketPrice>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MarketPrice {
    id: String,
    source: String,
    price: String,
    change_pct: Option<String>,
    volume_24h: Option<String>,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut ws_tx, mut ws_rx) = socket.split();

    // batch_id → (source, market_ids)
    let subscriptions: Arc<tokio::sync::RwLock<HashMap<u64, (String, HashSet<String>)>>> =
        Arc::new(tokio::sync::RwLock::new(HashMap::new()));

    // source → broadcast receiver task handle
    let source_tasks: Arc<tokio::sync::RwLock<HashMap<String, tokio::task::JoinHandle<()>>>> =
        Arc::new(tokio::sync::RwLock::new(HashMap::new()));

    // Channel for forwarding filtered prices to the WS sender
    let (fwd_tx, mut fwd_rx) = tokio::sync::mpsc::channel::<String>(256);

    // Task: forward filtered messages to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = fwd_rx.recv().await {
            if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Task: read client messages (subscribe/unsubscribe)
    let subs_clone = subscriptions.clone();
    let tasks_clone = source_tasks.clone();
    let state_clone = state.clone();
    let fwd_tx_clone = fwd_tx.clone();

    while let Some(Ok(msg)) = ws_rx.next().await {
        let text = match msg {
            Message::Text(t) => t.to_string(),
            Message::Close(_) => break,
            _ => continue,
        };

        let parsed: ClientMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                debug!("Invalid WS message: {}", e);
                continue;
            }
        };

        // Handle subscribes
        if let Some(batch_ids) = parsed.subscribe {
            for batch_id in batch_ids {
                match state_clone.vision_batch_cache.get(batch_id).await {
                    Ok(info) => {
                        let market_set: HashSet<String> = info.market_ids.into_iter().collect();
                        let source = info.source.clone();

                        subs_clone.write().await.insert(batch_id, (source.clone(), market_set));

                        // Ensure we have a broadcast listener for this source
                        let mut tasks = tasks_clone.write().await;
                        if !tasks.contains_key(&source) {
                            let rx = state_clone.price_broadcast.subscribe(&source).await;
                            let subs_ref = subs_clone.clone();
                            let fwd = fwd_tx_clone.clone();

                            let handle = tokio::spawn(source_listener(rx, source.clone(), subs_ref, fwd));
                            tasks.insert(source, handle);
                        }

                        info!("WS client subscribed to batch {}", batch_id);
                    }
                    Err(e) => {
                        warn!("WS subscribe failed for batch {}: {}", batch_id, e);
                    }
                }
            }
        }

        // Handle unsubscribes
        if let Some(batch_ids) = parsed.unsubscribe {
            let mut subs = subs_clone.write().await;
            for batch_id in batch_ids {
                subs.remove(&batch_id);
                info!("WS client unsubscribed from batch {}", batch_id);
            }
        }
    }

    // Cleanup
    drop(fwd_tx);
    send_task.abort();
    let tasks = source_tasks.read().await;
    for handle in tasks.values() {
        handle.abort();
    }
}

/// Listen to a source's broadcast channel and forward filtered prices
async fn source_listener(
    mut rx: broadcast::Receiver<Arc<SourcePriceBatch>>,
    source: String,
    subscriptions: Arc<tokio::sync::RwLock<HashMap<u64, (String, HashSet<String>)>>>,
    fwd_tx: tokio::sync::mpsc::Sender<String>,
) {
    loop {
        match rx.recv().await {
            Ok(batch) => {
                let subs = subscriptions.read().await;
                for (batch_id, (sub_source, market_ids)) in subs.iter() {
                    if *sub_source != source {
                        continue;
                    }

                    let filtered: Vec<MarketPrice> = batch
                        .prices
                        .iter()
                        .filter(|p| market_ids.contains(&p.asset_id))
                        .map(|p| MarketPrice {
                            id: p.asset_id.clone(),
                            source: p.source.clone(),
                            price: p.value.to_string(),
                            change_pct: p.change_pct.map(|v| v.to_string()),
                            volume_24h: p.volume_24h.map(|v| v.to_string()),
                        })
                        .collect();

                    if filtered.is_empty() {
                        continue;
                    }

                    let msg = PriceMessage {
                        r#type: "prices",
                        batch_id: *batch_id,
                        ts: batch.timestamp.to_rfc3339(),
                        markets: filtered,
                    };

                    if let Ok(json) = serde_json::to_string(&msg) {
                        if fwd_tx.send(json).await.is_err() {
                            return; // WS closed
                        }
                    }
                }
            }
            Err(broadcast::error::RecvError::Lagged(n)) => {
                warn!("WS source listener lagged {} messages for {}", n, source);
            }
            Err(broadcast::error::RecvError::Closed) => {
                break;
            }
        }
    }
}
```

**Step 2: Register the route**

In `data-node/src/api.rs`, add:
```rust
.route("/vision/ws", get(crate::vision_ws::ws_handler))
```

In `data-node/src/main.rs`, add:
```rust
mod vision_ws;
```

**Step 3: Run and verify it compiles**

Run: `cd data-node && cargo check 2>&1 | head -30`

**Step 4: Commit**

```bash
git add data-node/src/vision_ws.rs
git add -u data-node/src/api.rs data-node/src/main.rs
git commit -m "feat(data-node): WebSocket handler for batch-scoped price streaming"
```

---

### Task 6: Python VisionFeed SDK

**Files:**
- Create: `vision-bot/framework/feed.py`
- Modify: `vision-bot/requirements.txt`

**Step 1: Add websockets dependency**

In `vision-bot/requirements.txt`, add:
```
websockets>=12.0
```

**Step 2: Create the feed module**

Create `vision-bot/framework/feed.py`:

```python
"""
WebSocket-based market data feed for Vision batches.

Usage:
    feed = VisionFeed(ws_url="ws://localhost:8200/vision/ws", http_url="http://localhost:8200")
    feed.subscribe(["1", "3"], history_days=7)

    prices = feed.prices("1")        # latest prices, updated in background
    history = feed.history("1", "bitcoin")  # 7d history, fetched once

    feed.unsubscribe(["1"])
    feed.close()
"""

import json
import logging
import threading
import time
from typing import Optional

import requests
import websockets
import websockets.sync.client

log = logging.getLogger(__name__)


class VisionFeed:
    def __init__(self, ws_url: str, http_url: str):
        self._ws_url = ws_url
        self._http_url = http_url.rstrip("/")
        self._prices: dict[str, dict[str, dict]] = {}  # batch_id → asset_id → {price, ...}
        self._history: dict[str, dict[str, list]] = {}  # batch_id → asset_id → [{ts, price, ...}]
        self._subscribed: set[str] = set()
        self._lock = threading.Lock()
        self._ws: Optional[websockets.sync.client.ClientConnection] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._connect()

    def _connect(self):
        """Connect WebSocket and start listener thread."""
        self._running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()

    def _listen_loop(self):
        """Reconnect loop with exponential backoff."""
        backoff = 1
        while self._running:
            try:
                self._ws = websockets.sync.client.connect(self._ws_url)
                log.info("WebSocket connected to %s", self._ws_url)
                backoff = 1

                # Re-subscribe on reconnect
                if self._subscribed:
                    msg = json.dumps({"subscribe": list(self._subscribed)})
                    self._ws.send(msg)

                for raw in self._ws:
                    if not self._running:
                        break
                    try:
                        data = json.loads(raw)
                        self._handle_message(data)
                    except json.JSONDecodeError:
                        pass

            except Exception as e:
                if not self._running:
                    break
                log.warning("WebSocket error: %s, reconnecting in %ds", e, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 30)

    def _handle_message(self, data: dict):
        """Process incoming price message."""
        if data.get("type") != "prices":
            return

        batch_id = str(data["batchId"])
        with self._lock:
            if batch_id not in self._prices:
                self._prices[batch_id] = {}

            for m in data.get("markets", []):
                asset_id = m["id"]
                self._prices[batch_id][asset_id] = {
                    "price": float(m["price"]),
                    "change_pct": float(m["changePct"]) if m.get("changePct") else None,
                    "volume_24h": float(m["volume24h"]) if m.get("volume24h") else None,
                }

                # Append to history if we have it
                if batch_id in self._history and asset_id in self._history[batch_id]:
                    self._history[batch_id][asset_id].append({
                        "ts": data["ts"],
                        "price": float(m["price"]),
                        "change_pct": float(m["changePct"]) if m.get("changePct") else None,
                    })

    def subscribe(self, batch_ids: list[str], history_days: int = 0):
        """Subscribe to batch price feeds. Optionally fetch history (once)."""
        new_ids = [bid for bid in batch_ids if bid not in self._subscribed]
        if not new_ids:
            return

        self._subscribed.update(new_ids)

        # Send WS subscribe
        if self._ws:
            try:
                self._ws.send(json.dumps({"subscribe": new_ids}))
            except Exception:
                pass  # Will re-subscribe on reconnect

        # Fetch history via HTTP (in parallel threads)
        if history_days > 0:
            for bid in new_ids:
                threading.Thread(
                    target=self._fetch_history,
                    args=(bid, history_days),
                    daemon=True,
                ).start()

    def _fetch_history(self, batch_id: str, days: int):
        """Fetch batch history via HTTP and cache locally."""
        url = f"{self._http_url}/vision/batch/{batch_id}/history?days={days}"
        try:
            resp = requests.get(url, timeout=30)
            if not resp.ok:
                log.warning("History fetch failed for batch %s: %s", batch_id, resp.status_code)
                return

            data = resp.json()
            with self._lock:
                self._history[batch_id] = {}
                for market in data.get("markets", []):
                    asset_id = market["id"]
                    self._history[batch_id][asset_id] = [
                        {
                            "ts": p["ts"],
                            "price": float(p["price"]),
                            "change_pct": float(p.get("changePct") or 0),
                        }
                        for p in market.get("prices", [])
                    ]
            log.info("Fetched %dd history for batch %s (%d markets)", days, batch_id, len(data.get("markets", [])))
        except Exception as e:
            log.warning("History fetch error for batch %s: %s", batch_id, e)

    def unsubscribe(self, batch_ids: list[str]):
        """Unsubscribe from batch price feeds."""
        self._subscribed -= set(batch_ids)
        if self._ws:
            try:
                self._ws.send(json.dumps({"unsubscribe": batch_ids}))
            except Exception:
                pass
        with self._lock:
            for bid in batch_ids:
                self._prices.pop(bid, None)
                self._history.pop(bid, None)

    def prices(self, batch_id: str) -> dict[str, dict]:
        """Get latest prices for a batch. Returns {asset_id: {price, change_pct, volume_24h}}."""
        with self._lock:
            return dict(self._prices.get(batch_id, {}))

    def history(self, batch_id: str, asset_id: str) -> list[dict]:
        """Get cached price history for a market in a batch."""
        with self._lock:
            return list(self._history.get(batch_id, {}).get(asset_id, []))

    def close(self):
        """Disconnect and stop listener thread."""
        self._running = False
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
        if self._thread:
            self._thread.join(timeout=5)
```

**Step 3: Commit**

```bash
git add vision-bot/framework/feed.py vision-bot/requirements.txt
git commit -m "feat(vision-bot): VisionFeed WebSocket client with history caching"
```

---

### Task 7: Integrate VisionFeed into Bot

**Files:**
- Modify: `vision-bot/bot.py`
- Modify: `vision-bot/framework/chain.py` (keep fetch_markets as fallback)

**Step 1: Initialize VisionFeed in bot startup**

In `vision-bot/bot.py`, add feed initialization before the main loop. The feed should be created once and passed into `run_cycle`.

Add import:
```python
from framework.feed import VisionFeed
```

Before the main loop (near line 165), create the feed:
```python
feed = VisionFeed(
    ws_url=cfg["data_node"].replace("http", "ws") + "/vision/ws",
    http_url=cfg["data_node"],
)
```

**Step 2: Use feed.prices() instead of fetch_markets()**

In `run_cycle()` (around line 77), replace:
```python
markets = fetch_markets(cfg["data_node"], market_ids)
```

With:
```python
# Subscribe to batch if not already subscribed
feed.subscribe([str(batch_id)], history_days=7)
# Get latest prices from live feed
raw_prices = feed.prices(str(batch_id))
if raw_prices:
    markets = [
        {
            "id": mid,
            "price": raw_prices.get(mid, {}).get("price", 0),
            "change": raw_prices.get(mid, {}).get("change_pct"),
            "volume": raw_prices.get(mid, {}).get("volume_24h"),
            "market_cap": None,
        }
        for mid in market_ids
    ]
else:
    # Fallback to HTTP if WS hasn't received data yet
    markets = fetch_markets(cfg["data_node"], market_ids)
```

**Step 3: Pass feed into run_cycle**

Update `run_cycle` signature to accept `feed: VisionFeed` parameter. Update all call sites.

**Step 4: Add feed.close() on shutdown**

In the main loop's KeyboardInterrupt handler or atexit, call `feed.close()`.

**Step 5: Test manually**

Run: `cd vision-bot && python -c "from framework.feed import VisionFeed; print('import OK')"`
Expected: `import OK`

**Step 6: Commit**

```bash
git add -u vision-bot/bot.py
git commit -m "feat(vision-bot): integrate VisionFeed, fallback to HTTP polling"
```

---

### Task 8: End-to-End Test

**Files:** None (manual verification)

**Step 1: Start data-node with issuer URL configured**

Run: Start data-node with `ISSUER_URL` env var pointing to issuer.

**Step 2: Test history endpoint**

```bash
curl -s http://localhost:8200/vision/batch/1/history?days=7 | python3 -m json.tool | head -30
```

Expected: JSON with `batchId`, `source`, `markets` array containing price history.

**Step 3: Test WebSocket**

```bash
python3 -c "
import websockets.sync.client, json
ws = websockets.sync.client.connect('ws://localhost:8200/vision/ws')
ws.send(json.dumps({'subscribe': [1]}))
msg = ws.recv(timeout=120)
print(json.loads(msg))
ws.close()
"
```

Expected: A `{"type": "prices", "batchId": 1, ...}` message within the source's collector interval.

**Step 4: Test bot feed integration**

Run the bot with `--dry-run` or equivalent and verify it subscribes and receives prices via WebSocket instead of polling `/vision/snapshot`.

**Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: address issues found in e2e testing of batch subscription"
```
