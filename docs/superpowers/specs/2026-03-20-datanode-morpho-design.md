# Data-Node Morpho Consolidation — Design Spec

## Problem

Frontend multicalls 154 RPC calls from the browser every 30s. Curator makes ~60 direct RPC calls per cycle. Both read the same Morpho market data independently. The data-node already polls and caches chain state but only for one singleton market.

## Decision

Data-node becomes the single source of truth for all Morpho reads. Frontend and curator consume it. Nobody touches RPC directly except for transaction broadcasts.

## Changes

### 1. Data-node: `poll_morpho_markets_once()` — poll all markets

New poller in `chain_pollers.rs`. Reads `batch-markets.json` at startup for all market IDs. Every 30s:
- Calls `Morpho.market(id)` for each market → `(totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee)`
- Calls `CuratorRateIRM.rates(id)` for each market → borrow rate per second
- Caches in `MorphoMarketsCache` (a `HashMap<String, MorphoMarketState>` in `chain_cache.rs`)

### 2. Data-node: `GET /morpho-markets` endpoint

Returns all cached market states:
```json
{
  "markets": [
    {
      "marketId": "0x...",
      "collateralToken": "0x...",
      "totalSupplyAssets": "123...",
      "totalBorrowAssets": "456...",
      "borrowRatePerSecond": "1585489599",
      "lastUpdate": 1773900000
    },
    ...
  ]
}
```

Served from cache. No RPC on request path. 30s staleness max.

### 3. Data-node: `GET /morpho-position?user=X&market_id=Y`

Extend existing `/morpho-position` to accept optional `market_id` parameter. When provided, reads position for that specific market instead of the singleton. When omitted, falls back to singleton (backward compatible).

### 4. Frontend: `useAllMorphoMarkets` → REST

Replace the 154-call multicall in `useAllMorphoMarkets.ts` with a single fetch to `/api/dn/morpho-markets`. Parse the response into the same `Map<string, AllMarketData>` shape. Same 30s polling interval. Eliminates all direct Morpho RPC from the browser.

### 5. Curator: `data_node_client.rs` — add market reads

Add methods:
- `get_all_markets()` → fetches `/morpho-markets` from data-node
- `get_position(market_id, user)` → fetches `/morpho-position?user=X&market_id=Y`

Update consumers:
- `allocator.rs`: `read_market_metrics()` and `read_vault_supply_in_market()` → use `get_all_markets()`
- `health_monitor.rs`: `read_market_data()`, `read_position()` → use data-node client
- `market_deployer.rs`: `read_supply_queue()`, `get_collaterals_for_markets()` → use data-node client
- `rate_pusher.rs`: `read_current_rate()` → use data-node client (rate is in `/morpho-markets` response)

Keep direct RPC for: `send_transaction()`, `get_chainid()`, all write operations.

### 6. Data-node: vault + ITP discovery endpoints

For market deployer:
- `GET /morpho-vault/supply-queue` → returns supply queue market IDs
- `GET /index/itp-vaults` → returns all ITP vault addresses

These replace the N+1 RPC loops the market deployer currently does.

## Files Modified

| Layer | File | Change |
|-------|------|--------|
| Data-node | `chain_cache.rs` | Add `MorphoMarketsCache` struct |
| Data-node | `chain_pollers.rs` | Add `poll_morpho_markets_once()` |
| Data-node | `api.rs` | Add `/morpho-markets`, `/morpho-vault/supply-queue`, `/index/itp-vaults` endpoints. Extend `/morpho-position` with `market_id` param |
| Frontend | `hooks/useAllMorphoMarkets.ts` | Replace multicall with REST fetch |
| Curator | `data_node_client.rs` | Add `get_all_markets()`, `get_position()` |
| Curator | `allocator.rs` | Replace direct RPC reads with data-node client |
| Curator | `health_monitor.rs` | Replace direct RPC reads with data-node client |
| Curator | `market_deployer.rs` | Replace discovery RPC with data-node endpoints |
| Curator | `rate_pusher.rs` | Replace rate reads with data-node client |

## What stays on direct RPC

All write operations — these MUST go through RPC:
- `Morpho.reallocate()` (allocator)
- `CuratorRateIRM.setRate()` / `setRates()` (rate pusher)
- `Morpho.createMarket()` (market deployer)
- `MetaMorpho.submitCap()` / `acceptCap()` (market deployer)
- Oracle `updatePrice()` (collector)
- `get_chainid()` for tx signing

## Cache Staleness

- Market state: 30s (same as current user position polling)
- Supply queue: 60s (changes rarely — only on market deploy)
- ITP vaults: 300s (changes only on vault deployment)
- Positions: 30s per user (existing behavior)
