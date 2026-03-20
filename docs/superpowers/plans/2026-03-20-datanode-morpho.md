# Data-Node Morpho Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the data-node the single source for all Morpho chain reads. Frontend and curator consume REST endpoints instead of direct RPC.

**Architecture:** Data-node polls all 77 Morpho markets every 30s via `MorphoPoller` + `IrmReader` (already defined in `chain_pollers.rs`), caches in `MorphoMarketsCache`, serves via `GET /morpho-markets`. Frontend replaces 154-call multicall with one REST fetch. Curator replaces ~60 direct RPC calls with data-node client methods.

**Tech Stack:** Rust/axum (data-node), TypeScript/React (frontend), Rust (curator)

**Spec:** `docs/superpowers/specs/2026-03-20-datanode-morpho-design.md`

---

## Task 1: Data-node — Cache + Poller + Endpoint

**Files:**
- Modify: `data-node/src/chain_cache.rs` — add `MorphoMarketState` struct and `MorphoMarketsCache`
- Modify: `data-node/src/chain_pollers.rs` — add `poll_morpho_markets_once()` using existing `MorphoPoller` + `IrmReader` abigen
- Modify: `data-node/src/api.rs` — add `GET /morpho-markets` endpoint, extend `/morpho-position` with `market_id` param
- Modify: `data-node/src/main.rs` — wire the new poller into the poll loop

**Context:**
- `chain_pollers.rs` already has `MorphoPoller` abigen (line 57) with `position(bytes32,address)` and `IrmReader` abigen (line 63) with `rates(bytes32)`. But `MorphoPoller` is MISSING the `market(bytes32)` function — it needs to be added.
- `chain_cache.rs` follows a pattern: struct + cache wrapper. See `NavSnapshot` (line 21) and `ItpStateCache` (line 89).
- `api.rs` routes are registered at lines 415-465. Endpoints read from `AppState` which holds the cache.
- The poll loop is in `main.rs` — search for `poll_morpho_position_once` to find where Morpho polling is wired.
- `batch-markets.json` is loaded via `state.morpho_batch_markets` or similar. Check `AppState` in `api.rs` for the field name. If it doesn't exist, the batch markets JSON needs to be loaded at startup.

- [ ] **Step 1: Add `market()` to MorphoPoller abigen**

In `chain_pollers.rs`, the `MorphoPoller` abigen (line 57) only has `position`. Add `market`:
```rust
abigen!(
    MorphoPoller,
    r#"[
        function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
        function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)
    ]"#
);
```

- [ ] **Step 2: Add `MorphoMarketState` and `MorphoMarketsCache` to `chain_cache.rs`**

```rust
#[derive(Clone, Serialize, Default)]
pub struct MorphoMarketState {
    pub market_id: String,
    pub collateral_token: String,
    pub total_supply_assets: String,
    pub total_borrow_assets: String,
    pub borrow_rate_per_second: String,
    pub last_update: u64,
}

pub struct MorphoMarketsCache {
    pub markets: Vec<MorphoMarketState>,
    pub gen: Generation,
}

impl MorphoMarketsCache {
    pub fn new() -> Self {
        Self { markets: Vec::new(), gen: Generation::default() }
    }
}
```

Add `pub morpho_markets: RwLock<MorphoMarketsCache>` to the `ChainCache` struct (or wherever global cache lives — check `AppState`).

- [ ] **Step 3: Add `poll_morpho_markets_once()` to `chain_pollers.rs`**

```rust
pub async fn poll_morpho_markets_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let morpho_addr = crate::api::deployment_addr(&state.morpho_deployment, "MORPHO")?;
    let morpho = MorphoPoller::new(morpho_addr, Arc::clone(&state.l3_provider));

    let irm_addr = crate::api::morpho_irm_addr(&state.morpho_deployment)?;
    let irm = IrmReader::new(irm_addr, Arc::clone(&state.l3_provider));

    // Read batch markets from state
    let batch_markets = &state.batch_markets;
    let mut results = Vec::new();

    for m in batch_markets {
        let market_id_hex = m.market_id.strip_prefix("0x").unwrap_or(&m.market_id);
        let mut market_id_bytes = [0u8; 32];
        if let Ok(bytes) = hex::decode(market_id_hex) {
            let len = bytes.len().min(32);
            market_id_bytes[..len].copy_from_slice(&bytes[..len]);
        }

        let (total_supply_assets, _total_supply_shares, total_borrow_assets, _total_borrow_shares, last_update, _fee) =
            morpho.market(market_id_bytes).call().await.unwrap_or_default();

        let rate = irm.rates(market_id_bytes).call().await.unwrap_or_default();

        results.push(MorphoMarketState {
            market_id: m.market_id.clone(),
            collateral_token: m.collateral_token.clone(),
            total_supply_assets: total_supply_assets.to_string(),
            total_borrow_assets: total_borrow_assets.to_string(),
            borrow_rate_per_second: rate.to_string(),
            last_update: last_update as u64,
        });
    }

    let mut cache = state.chain_cache.morpho_markets.write().await;
    cache.markets = results;
    cache.gen.bump();
    Ok(())
}
```

- [ ] **Step 4: Load `batch-markets.json` at data-node startup**

In `main.rs` or `api.rs` where `AppState` is constructed, load the batch markets:
```rust
// In AppState or config
pub struct BatchMarketEntry {
    pub market_id: String,
    pub collateral_token: String,
}

// Load from file at startup
let batch_markets: Vec<BatchMarketEntry> = if let Ok(data) = std::fs::read_to_string("batch-markets.json") {
    serde_json::from_str::<serde_json::Value>(&data)
        .ok()
        .and_then(|v| v["markets"].as_array().cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(|m| Some(BatchMarketEntry {
            market_id: m["marketId"].as_str()?.to_string(),
            collateral_token: m["collateralToken"].as_str()?.to_string(),
        }))
        .collect()
} else {
    Vec::new()
};
```

- [ ] **Step 5: Wire poller into main poll loop**

Find where `poll_morpho_position_once` is called in `main.rs`. Add `poll_morpho_markets_once` with the same interval (30s):
```rust
if let Err(e) = poll_morpho_markets_once(&state).await {
    warn!("Morpho markets poll failed: {}", e);
}
```

- [ ] **Step 6: Add `GET /morpho-markets` endpoint**

In `api.rs`, add route:
```rust
.route("/morpho-markets", get(morpho_markets))
```

Handler:
```rust
async fn morpho_markets(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let cache = state.chain_cache.morpho_markets.read().await;
    Json(serde_json::json!({ "markets": cache.markets }))
}
```

- [ ] **Step 7: Extend `/morpho-position` with optional `market_id` param**

Add `market_id` to `MorphoPositionQuery`:
```rust
struct MorphoPositionQuery {
    user: String,
    market_id: Option<String>,
}
```

In the handler, if `market_id` is provided, use it instead of the hardcoded `MARKET_ID`:
```rust
let market_id_str = params.market_id
    .as_deref()
    .or_else(|| state.morpho_deployment["contracts"]["MARKET_ID"].as_str())
    .ok_or_else(|| rpc_error("Missing market_id".to_string()))?;
```

- [ ] **Step 8: Build and test**

```bash
cd data-node && cargo build 2>&1 | tail -5
```

- [ ] **Step 9: Commit**

```bash
git add data-node/src/chain_cache.rs data-node/src/chain_pollers.rs data-node/src/api.rs data-node/src/main.rs
git commit -m "feat: data-node polls all Morpho markets, serves /morpho-markets endpoint"
```

---

## Task 2: Frontend — Switch to REST

**Files:**
- Modify: `frontend/hooks/useAllMorphoMarkets.ts` — replace multicall with REST fetch

**Context:** Currently makes 154 direct RPC calls via `useReadContracts`. Replace with `useQuery` fetching `GET /api/dn/morpho-markets`. The `/api/dn/*` catch-all proxy routes to the data-node. The `AllMarketData` interface and `Map<string, AllMarketData>` return shape stay the same.

- [ ] **Step 1: Rewrite `useAllMorphoMarkets` to use REST**

```typescript
'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAllMorphoMarkets } from '@/lib/contracts/morpho-markets-registry'

const SECONDS_PER_YEAR = 365.25 * 86400

export interface AllMarketData {
  totalSupplyAssets: bigint
  totalBorrowAssets: bigint
  utilization: number
  borrowApy: number
  supplyApy: number
  lltv: bigint
  marketId: string
}

interface MarketResponse {
  market_id: string
  collateral_token: string
  total_supply_assets: string
  total_borrow_assets: string
  borrow_rate_per_second: string
  last_update: number
}

const allMarkets = getAllMorphoMarkets()
const registryByMarketId = new Map(allMarkets.map(m => [m.marketId.toLowerCase(), m]))

export function useAllMorphoMarkets() {
  const { data: rawMarkets, isLoading } = useQuery<MarketResponse[]>({
    queryKey: ['morpho-markets'],
    queryFn: async () => {
      const res = await fetch('/api/dn/morpho-markets')
      if (!res.ok) return []
      const data = await res.json()
      return data.markets ?? []
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const marketsMap = useMemo(() => {
    const map = new Map<string, AllMarketData>()
    if (!rawMarkets) return map

    for (const m of rawMarkets) {
      const totalSupplyAssets = BigInt(m.total_supply_assets || '0')
      const totalBorrowAssets = BigInt(m.total_borrow_assets || '0')

      const utilization = totalSupplyAssets > 0n
        ? Number((totalBorrowAssets * 10000n) / totalSupplyAssets) / 100
        : 0

      let borrowApy = 0
      const ratePerSec = Number(BigInt(m.borrow_rate_per_second || '0')) / 1e18
      if (ratePerSec > 0) {
        borrowApy = ratePerSec * SECONDS_PER_YEAR * 100
      }
      if (borrowApy === 0 && utilization > 0) {
        borrowApy = 2 + utilization * 0.15
      }

      const supplyApy = utilization > 0 ? (borrowApy * utilization) / 100 : 0

      // Look up registry entry for lltv
      const registry = registryByMarketId.get(m.market_id.toLowerCase())
      const lltv = registry?.lltv ?? 770000000000000000n

      map.set(m.collateral_token.toLowerCase(), {
        totalSupplyAssets,
        totalBorrowAssets,
        utilization,
        borrowApy,
        supplyApy,
        lltv,
        marketId: m.market_id,
      })
    }

    return map
  }, [rawMarkets])

  return { data: marketsMap, isLoading }
}
```

- [ ] **Step 2: Remove unused imports**

Delete imports of `useReadContracts`, `MORPHO_ABI`, `CURATOR_RATE_IRM_ABI`, `MORPHO_ADDRESSES`, `indexL3` from the hook — they're no longer needed.

- [ ] **Step 3: Type-check + build**

```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | head -10
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add frontend/hooks/useAllMorphoMarkets.ts
git commit -m "feat: useAllMorphoMarkets fetches from data-node REST instead of 154 RPC multicalls"
```

---

## Task 3: Curator — Switch reads to data-node client

**Files:**
- Modify: `curator/src/data_node_client.rs` — add `get_all_markets()`, `get_position()`
- Modify: `curator/src/allocator.rs` — replace `read_market_metrics()` direct RPC with data-node
- Modify: `curator/src/health_monitor.rs` — replace `read_market_data()` direct RPC with data-node
- Modify: `curator/src/market_deployer.rs` — replace discovery RPCs with data-node
- Modify: `curator/src/rate_pusher.rs` — replace `read_current_rate()` with data-node

**Context:** The `DataNodeClient` at `data_node_client.rs` already follows a pattern: one struct per response, one method per endpoint, all async returning `Result<T, DataNodeError>`. The curator holds a `data_node_client: Option<DataNodeClient>` — when `None`, it falls back to direct RPC. This fallback pattern must be preserved.

- [ ] **Step 1: Add response types and methods to `data_node_client.rs`**

```rust
#[derive(Deserialize, Clone)]
pub struct MorphoMarketData {
    pub market_id: String,
    pub collateral_token: String,
    pub total_supply_assets: String,
    pub total_borrow_assets: String,
    pub borrow_rate_per_second: String,
    pub last_update: u64,
}

#[derive(Deserialize)]
struct MorphoMarketsResponse {
    markets: Vec<MorphoMarketData>,
}

impl DataNodeClient {
    /// GET /morpho-markets
    pub async fn get_all_markets(&self) -> Result<Vec<MorphoMarketData>, DataNodeError> {
        let url = format!("{}/morpho-markets", self.base_url);
        debug!(url = %url, "Fetching all Morpho markets from data-node");
        let resp: MorphoMarketsResponse = self.client.get(&url).send().await
            .map_err(|e| DataNodeError::Http(format!("{}: {}", url, e)))?
            .json().await
            .map_err(|e| DataNodeError::Parse(format!("{}: {}", url, e)))?;
        Ok(resp.markets)
    }
}
```

- [ ] **Step 2: Update allocator to use data-node for market reads**

In `allocator.rs`, find `read_market_metrics()` (around line 314). Add a data-node path:
```rust
// Try data-node first
if let Some(client) = &self.data_node_client {
    if let Ok(markets) = client.get_all_markets().await {
        // Use cached data instead of RPC
        // ... parse and return
    }
}
// Fallback to direct RPC (existing code)
```

Follow the same pattern as `collector.rs` lines 550-587 which tries data-node first and falls back to RPC.

- [ ] **Step 3: Update rate_pusher to read rates from data-node**

In `rate_pusher.rs`, `read_current_rate()` calls `irm.rates(id)` directly. Add data-node path — the rate is in the `/morpho-markets` response as `borrow_rate_per_second`. Look up the market by ID from the cached response.

- [ ] **Step 4: Build curator**

```bash
cd curator && cargo build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add curator/src/data_node_client.rs curator/src/allocator.rs curator/src/rate_pusher.rs
git commit -m "feat: curator reads Morpho market data from data-node instead of direct RPC"
```

---

## Task 4: Push + verify

- [ ] **Step 1: Full build check**

```bash
cd data-node && cargo build 2>&1 | tail -3
cd ../curator && cargo build 2>&1 | tail -3
cd ../frontend && npx tsc --noEmit && npx next build 2>&1 | tail -3
```

- [ ] **Step 2: Push**

```bash
git push mono main
```
