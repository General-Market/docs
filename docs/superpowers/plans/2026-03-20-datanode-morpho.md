# Data-Node Morpho Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the data-node the single source for all Morpho chain reads. Frontend and curator consume REST endpoints instead of direct RPC.

**Architecture:** Data-node polls all Morpho markets every 30s via parallel `MorphoPoller` + `IrmReader` calls, caches in `CachedMorphoMarket` (renamed to avoid collision with existing `MorphoMarketState` in api.rs), serves via `GET /morpho-markets`. Frontend replaces 154-call multicall with one REST fetch. Curator reads from data-node with RPC fallback for writes.

**Tech Stack:** Rust/axum (data-node), TypeScript/React (frontend), Rust (curator)

**Spec:** `docs/superpowers/specs/2026-03-20-datanode-morpho-design.md`

**Scope (this phase):** `/morpho-markets` endpoint + frontend + curator allocator/rate_pusher. **Deferred to phase 2:** health_monitor migration, market_deployer migration, `/morpho-vault/supply-queue` + `/index/itp-vaults` endpoints, multi-market position poller.

**Audit fixes applied:** 11 issues from 3 cynical security researchers (4 CRIT, 7 HIGH).

---

## Task 1: Data-node — Cache + Poller + Endpoint

**Files:**
- Modify: `data-node/src/chain_cache.rs` — add `CachedMorphoMarket` struct (NOT `MorphoMarketState` — name collision with api.rs:2645)
- Modify: `data-node/src/chain_pollers.rs` — add `market()` to `MorphoPoller` abigen, add `poll_morpho_markets_once()` with parallel calls
- Modify: `data-node/src/api.rs` — add `GET /morpho-markets` endpoint, add `BatchMarketEntry` to `AppState`, extend `/morpho-position` with `market_id` + per-market oracle/lltv
- Modify: `data-node/src/main.rs` — load `batch-markets.json`, add field to AppState, wire poller
- Modify: `docker/testnet/data-node/docker-compose.yml` — add `batch-markets.json` volume mount

- [ ] **Step 1: Add `market()` to MorphoPoller abigen in `chain_pollers.rs`**

The existing `MorphoPoller` (line 57) only has `position`. Add `market`. Morpho Blue's `market()` returns a `Market` struct — but via ethers abigen it decodes as a tuple. Check the ABI: the Solidity signature is `market(Id) returns (Market memory)` where Market has fields `(uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)`:
```rust
abigen!(
    MorphoPoller,
    r#"[
        function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
        function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)
        function idToMarketParams(bytes32 id) external view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)
    ]"#
);
```

Also add `idToMarketParams` — needed for `/morpho-position` per-market oracle resolution.

- [ ] **Step 2: Add `CachedMorphoMarket` and cache to `chain_cache.rs`**

Use `CachedMorphoMarket` (NOT `MorphoMarketState` — that name is already taken at api.rs:2645):
```rust
#[derive(Clone, Serialize, Default)]
pub struct CachedMorphoMarket {
    pub market_id: String,
    pub collateral_token: String,
    pub total_supply_assets: String,
    pub total_supply_shares: String,  // needed by allocator for share→asset conversion
    pub total_borrow_assets: String,
    pub total_borrow_shares: String,  // needed by position handler for debt computation
    pub borrow_rate_per_second: String,
    pub lltv: String,                 // per-market, NOT hardcoded 77%
    pub oracle: String,               // per-market oracle address
    pub last_update: u64,
}
```

Add to the global cache (find `ChainCache` or equivalent struct in chain_cache.rs):
```rust
pub morpho_markets: RwLock<Vec<CachedMorphoMarket>>,
pub morpho_markets_gen: Generation,
```

- [ ] **Step 3: Add `BatchMarketEntry` struct and load batch-markets.json**

In `api.rs` or a new `morpho_types.rs`:
```rust
#[derive(Clone, Deserialize)]
pub struct BatchMarketEntry {
    #[serde(rename = "marketId")]
    pub market_id: String,
    #[serde(rename = "collateralToken")]
    pub collateral_token: String,
    pub oracle: String,
    pub irm: String,
    pub lltv: String,
}
```

Add `pub batch_markets: Vec<BatchMarketEntry>` to `AppState`.

In `main.rs` where AppState is constructed, load from file:
```rust
let batch_markets_path = std::env::var("BATCH_MARKETS_FILE")
    .unwrap_or_else(|_| "deployments/batch-markets.json".to_string());
let batch_markets: Vec<BatchMarketEntry> = std::fs::read_to_string(&batch_markets_path)
    .ok()
    .and_then(|data| serde_json::from_str::<serde_json::Value>(&data).ok())
    .and_then(|v| serde_json::from_value(v["markets"].clone()).ok())
    .unwrap_or_default();
```

- [ ] **Step 4: Add Docker volume mount for batch-markets.json**

In `docker/testnet/data-node/docker-compose.yml`, add to volumes:
```yaml
  - ../../../deployments/batch-markets.json:/app/deployments/batch-markets.json:ro
```

- [ ] **Step 5: Add `poll_morpho_markets_once()` with PARALLEL calls**

```rust
pub async fn poll_morpho_markets_once(state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if state.batch_markets.is_empty() { return Ok(()); }

    let morpho_addr = crate::api::deployment_addr(&state.morpho_deployment, "MORPHO")?;
    let morpho = MorphoPoller::new(morpho_addr, Arc::clone(&state.l3_provider));

    // IRM address with fallback
    let irm_addr_str = state.morpho_deployment["contracts"].get("CURATOR_RATE_IRM")
        .or_else(|| state.morpho_deployment["contracts"].get("ADAPTIVE_IRM"))
        .and_then(|v| v.as_str())
        .unwrap_or("0x0000000000000000000000000000000000000000");
    let irm_addr: Address = irm_addr_str.parse().unwrap_or_default();
    let irm = IrmReader::new(irm_addr, Arc::clone(&state.l3_provider));

    // Parallel: fetch all markets concurrently
    let futures: Vec<_> = state.batch_markets.iter().map(|bm| {
        let morpho = morpho.clone();
        let irm = irm.clone();
        let bm = bm.clone();
        async move {
            let mut market_id_bytes = [0u8; 32];
            if let Ok(bytes) = hex::decode(bm.market_id.strip_prefix("0x").unwrap_or(&bm.market_id)) {
                let len = bytes.len().min(32);
                market_id_bytes[..len].copy_from_slice(&bytes[..len]);
            }
            let (tsa, tss, tba, tbs, lu, _fee) = morpho.market(market_id_bytes).call().await.unwrap_or_default();
            let rate = irm.rates(market_id_bytes).call().await.unwrap_or_default();
            CachedMorphoMarket {
                market_id: bm.market_id,
                collateral_token: bm.collateral_token,
                total_supply_assets: tsa.to_string(),
                total_supply_shares: tss.to_string(),
                total_borrow_assets: tba.to_string(),
                total_borrow_shares: tbs.to_string(),
                borrow_rate_per_second: rate.to_string(),
                lltv: bm.lltv,
                oracle: bm.oracle,
                last_update: lu as u64,
            }
        }
    }).collect();

    let results = futures::future::join_all(futures).await;

    let mut cache = state.chain_cache.morpho_markets.write().await;
    *cache = results;
    state.chain_cache.morpho_markets_gen.bump();
    Ok(())
}
```

- [ ] **Step 6: Wire poller in main.rs**

Find the poll loop (search for `poll_morpho_position_once`). Add alongside it:
```rust
if let Err(e) = crate::chain_pollers::poll_morpho_markets_once(&state).await {
    warn!("Morpho markets poll failed: {}", e);
}
```

- [ ] **Step 7: Add `GET /morpho-markets` endpoint**

Route: `.route("/morpho-markets", get(morpho_markets))`

Handler:
```rust
async fn morpho_markets(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let cache = state.chain_cache.morpho_markets.read().await;
    Json(serde_json::json!({ "markets": *cache }))
}
```

- [ ] **Step 8: Extend `/morpho-position` with market_id + per-market oracle/lltv**

Add `market_id` to query params. When provided, resolve oracle and lltv from batch_markets (no extra RPC):
```rust
let (market_id_str, oracle_addr, lltv) = if let Some(ref mid) = params.market_id {
    // Find market in batch_markets
    let bm = state.batch_markets.iter().find(|m| m.market_id.eq_ignore_ascii_case(mid));
    match bm {
        Some(entry) => (mid.as_str(), entry.oracle.parse::<Address>().unwrap_or_default(),
                       U256::from_dec_str(&entry.lltv).unwrap_or(U256::from(770000000000000000u64))),
        None => return Err(rpc_error(format!("Unknown market_id: {}", mid))),
    }
} else {
    // Singleton fallback (existing behavior)
    let mid = state.morpho_deployment["contracts"]["MARKET_ID"].as_str()
        .ok_or_else(|| rpc_error("Missing MARKET_ID".to_string()))?;
    let oracle = deployment_addr(&state.morpho_deployment, "ITP_NAV_ORACLE")
        .or_else(|_| deployment_addr(&state.morpho_deployment, "MOCK_ORACLE"))
        .map_err(|e| rpc_error(e))?;
    let lltv_val = /* existing lltv parsing */;
    (mid, oracle, lltv_val)
};
```

Use market-level data from cache when available (market state read) and only RPC for per-user position:
```rust
// Try cache first for market state
let cache = state.chain_cache.morpho_markets.read().await;
let cached = cache.iter().find(|m| m.market_id.eq_ignore_ascii_case(market_id_str));
let (total_supply_assets, total_supply_shares, total_borrow_assets, total_borrow_shares) = if let Some(c) = cached {
    (c.total_supply_assets.parse().unwrap_or_default(), /* ... */)
} else {
    // Fallback to RPC
    morpho.market(market_id_bytes).call().await.map_err(/* ... */)?
};
// User position always from RPC (per-user, not cacheable generically)
let (supply_shares, borrow_shares, collateral) = morpho.position(market_id_bytes, user).call().await /* ... */;
```

- [ ] **Step 9: Build and test**

```bash
cd data-node && cargo build 2>&1 | tail -5
```

- [ ] **Step 10: Commit**

```bash
git add data-node/src/ docker/testnet/data-node/docker-compose.yml
git commit -m "feat: data-node polls all Morpho markets in parallel, serves /morpho-markets with per-market oracle+lltv"
```

---

## Task 2: Frontend — Switch to REST

**Files:**
- Modify: `frontend/hooks/useAllMorphoMarkets.ts`

- [ ] **Step 1: Rewrite hook to fetch from data-node REST**

Replace the entire file. Use `useQuery` (already a dependency via `@tanstack/react-query` — used throughout the codebase). The response now includes `lltv` and `oracle` per market, so no registry fallback needed:

```typescript
'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

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
  lltv: string
  last_update: number
}

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
        ? Number((totalBorrowAssets * 10000n) / totalSupplyAssets) / 100 : 0

      let borrowApy = 0
      const ratePerSec = Number(BigInt(m.borrow_rate_per_second || '0')) / 1e18
      if (ratePerSec > 0) borrowApy = ratePerSec * SECONDS_PER_YEAR * 100
      if (borrowApy === 0 && utilization > 0) borrowApy = 2 + utilization * 0.15

      const supplyApy = utilization > 0 ? (borrowApy * utilization) / 100 : 0
      const lltv = BigInt(m.lltv || '770000000000000000')

      map.set(m.collateral_token.toLowerCase(), {
        totalSupplyAssets, totalBorrowAssets, utilization,
        borrowApy, supplyApy, lltv, marketId: m.market_id,
      })
    }
    return map
  }, [rawMarkets])

  return { data: marketsMap, isLoading }
}
```

- [ ] **Step 2: Type-check + build**

```bash
cd frontend && npx tsc --noEmit --pretty 2>&1 | head -10
npx next build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useAllMorphoMarkets.ts
git commit -m "feat: useAllMorphoMarkets fetches from data-node REST — zero direct RPC from browser"
```

---

## Task 3: Curator — Data-node client for market reads

**Files:**
- Modify: `curator/src/data_node_client.rs`
- Modify: `curator/src/allocator.rs` — add data-node path with RPC fallback
- Modify: `curator/src/rate_pusher.rs` — read rates from data-node

**Note:** Health monitor and market deployer migration deferred to phase 2. Allocator KEEPS direct RPC for the read-before-write path (reallocate) — stale cache data is too risky for write operations. Data-node is used for monitoring/display reads only.

- [ ] **Step 1: Add `get_all_markets()` to data_node_client.rs**

```rust
#[derive(Deserialize, Clone)]
pub struct MorphoMarketData {
    pub market_id: String,
    pub collateral_token: String,
    pub total_supply_assets: String,
    pub total_supply_shares: String,
    pub total_borrow_assets: String,
    pub total_borrow_shares: String,
    pub borrow_rate_per_second: String,
    pub lltv: String,
    pub oracle: String,
    pub last_update: u64,
}

#[derive(Deserialize)]
struct MorphoMarketsResponse {
    markets: Vec<MorphoMarketData>,
}

impl DataNodeClient {
    pub async fn get_all_markets(&self) -> Result<Vec<MorphoMarketData>, DataNodeError> {
        let url = format!("{}/morpho-markets", self.base_url);
        debug!(url = %url, "Fetching Morpho markets from data-node");
        let resp: MorphoMarketsResponse = self.client.get(&url).send().await
            .map_err(|e| DataNodeError::Http(format!("{}: {}", url, e)))?
            .json().await
            .map_err(|e| DataNodeError::Parse(format!("{}: {}", url, e)))?;
        Ok(resp.markets)
    }
}
```

- [ ] **Step 2: Add data-node path to allocator's metric reads**

In `allocator.rs`, find `read_market_metrics()`. Add data-node-first pattern (like collector.rs:550-564):
```rust
// Try data-node first for market state reads (monitoring/display)
if let Some(client) = &self.data_node_client {
    if let Ok(markets) = client.get_all_markets().await {
        // Cache locally for this cycle
        self.cached_markets = Some(markets);
    }
}
// For write operations (reallocate), ALWAYS use fresh RPC reads
```

Parse strings to U256 with `U256::from_dec_str()` — the data-node returns decimal strings.

- [ ] **Step 3: Rate pusher reads from data-node**

In `rate_pusher.rs`, `read_current_rate()` can use the cached market data — the rate is in the response as `borrow_rate_per_second`. Look up by market ID. Fall back to direct RPC if data-node is unavailable.

- [ ] **Step 4: Build**

```bash
cd curator && cargo build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add curator/src/data_node_client.rs curator/src/allocator.rs curator/src/rate_pusher.rs
git commit -m "feat: curator reads Morpho markets from data-node, keeps RPC for writes"
```

---

## Task 4: Push + verify

- [ ] **Step 1: Full build**

```bash
cd data-node && cargo build 2>&1 | tail -3
cd ../curator && cargo build 2>&1 | tail -3
cd ../frontend && npx tsc --noEmit && npx next build 2>&1 | tail -3
```

- [ ] **Step 2: Push**

```bash
git push mono main
```

---

## Deferred to Phase 2

- `health_monitor.rs` — 15 direct RPC calls, needs data-node migration
- `market_deployer.rs` — needs `/morpho-vault/supply-queue` + `/index/itp-vaults` endpoints
- Multi-market position poller — `poll_user_positions_once` only polls singleton market
- SSE stream per-market position awareness
