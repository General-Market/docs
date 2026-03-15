# 1000 ITP Scaling — Event-Driven Architecture

**Date:** 2026-03-15
**Status:** Draft
**Problem:** System polls on-chain for data that only changes on events. At 90 ITPs it's slow. At 1000 it's dead.

---

## Root Cause

Every poller calls the chain in a loop — `getITPState()`, `getUserShares()`, `getOrder()` — for data that only changes when the contract emits an event. The data-node already listens for these events but still polls redundantly. Prices come from Bitget, not the chain. NAV is computed off-chain.

**Current RPC budget at 90 ITPs:**
| Poller | Interval | RPC calls/poll | Calls/min |
|--------|----------|----------------|-----------|
| `poll_nav_once` | 60s | 90 `getITPState` | 90 |
| `poll_user_balances_once` | 1s | N_users × 90 `getUserShares` + 3/user | ~5,640 (1 user) |
| `poll_user_orders_once` | 1s | 2 × active_orders/user | ~100 |
| `poll_pending_orders_once` | 1s | 100 `getOrder` | 6,000 |
| `poll_batched_orders_once` | 2s | 100 `getOrder` | 3,000 |
| `itp_collector` periodic | 300s | 90 `getITPState` | 18 |

**Projected at 1000 ITPs:** `poll_user_balances_once` alone = 100,400 RPC calls/sec with 100 users. RPC dies.

---

## Solution: Event-Driven State + Cache-Only Reads

Stop polling the chain for data the chain already told us about.

### Principle

1. **Startup:** hydrate all state from chain (once)
2. **Steady-state:** events update in-memory cache, pollers read cache (zero RPC)
3. **Prices:** Bitget feeds, already working
4. **NAV:** computed from cached inventory × live prices (pure math, no RPC)

---

## Contract Changes

### File: `contracts/src/libraries/EventsLib.sol`

**Add 1 new event:**

```solidity
event SharesUpdated(
    bytes32 indexed itpId,
    address indexed user,
    uint256 newTotalSupply,
    uint256 userNewBalance
);
```

### File: `contracts/src/core/Investment.sol`

**Emit `SharesUpdated` at every totalSupply mutation:**

| Location | Line | Mutation | Emit after |
|----------|------|----------|------------|
| `fillOrders()` buy fill | ~451 | `totalSupply += shares` | Line ~455 |
| `_createOrder()` sell escrow | ~255 | `totalSupply -= amount` | Line ~256 |
| `cancelOrder()` sell restore | ~579 | `totalSupply += amount` | Line ~580 |
| `refundExpiredOrder()` sell restore | ~631 | `totalSupply += amount` | Line ~632 |
| `fillOrders()` partial sell refund | ~498 | `totalSupply += unfilledShares` | Line ~499 |
| `refundStalePendingOrders()` | ~1089 | `totalSupply += amount` | Line ~1090 |
| `refundBatchedOrder()` | ~1140 | `totalSupply += amount` | Line ~1141 |

**Emit `OrderStatusChanged` (optional, see below):**

```solidity
event OrderStatusChanged(
    uint256 indexed orderId,
    bytes32 indexed itpId,
    address indexed user,
    uint8 newStatus
);
```

Emitted at every status transition in the table above. However — the contract already emits `FillConfirmed`, `OrderCancelled`, `OrderRefunded`, `StalePendingOrdersCancelled`. These existing events cover all transitions. The data-node just needs to listen to them. **No new order event needed if we listen to what's already emitted.**

---

## Data-Node Changes

### 1. New in-memory ITP state cache

**File:** `data-node/src/chain_cache.rs` (or new `itp_state_cache.rs`)

```rust
pub struct ItpStateCache {
    pub states: HashMap<String, CachedItpState>,
}

pub struct CachedItpState {
    pub creator: Address,
    pub total_supply: U256,
    pub assets: Vec<Address>,
    pub weights: Vec<U256>,
    pub inventory: Vec<U256>,
    pub name: String,
    pub symbol: String,
    pub settlement_address: Option<String>,
}
```

Add `itp_states: RwLock<ItpStateCache>` to `AppState` / `ChainCache`.

### 2. Startup hydration — parallelize

**File:** `data-node/src/itp_collector.rs` lines 177–206

**Current:** sequential loop, 1 RPC per ITP.
**New:** batch into groups of 50, `futures::join_all` each batch.

```rust
// Before: 1000 ITPs × 100ms = 100s
for i in 1..=itp_count { store_itp_state(...).await; }

// After: 1000 ITPs / 50 per batch × 100ms = 2s
for chunk in (1..=itp_count).collect::<Vec<_>>().chunks(50) {
    let futs = chunk.iter().map(|i| store_itp_state(...));
    futures::future::join_all(futs).await;
}
```

Also populate `ItpStateCache` from the startup data (no extra RPC).

### 3. Kill periodic polling — replace with event-only updates

**File:** `data-node/src/itp_collector.rs` lines 364–386

**Delete the entire periodic snapshot block.** Replace with cache-based DB writes:

```rust
// Every 5 minutes, write snapshots FROM CACHE (zero RPC)
if last_periodic.elapsed().as_secs() >= periodic_interval_secs {
    let cache = state.itp_states.read().await;
    for (itp_id, itp) in &cache.states {
        db::upsert_itp_snapshot(&pool, itp_id, /* from cache fields */).await;
    }
    last_periodic = std::time::Instant::now();
}
```

### 4. Event handlers update cache

**File:** `data-node/src/itp_collector.rs`

**ITPCreated handler** (lines 254–269):
- Currently calls `getITPState()` — **keep this one** (creation is rare, need full state)
- Also insert into `ItpStateCache`

**Rebalanced handler** (lines 286–299):
- Event carries `newAssets`, `newWeights`, `newInventory`, `nav`
- Update cache directly from event data — **no `getITPState()` call**
- Still write DB snapshot

**FillConfirmed handler** (lines 327–340):
- Currently calls `getITPState()` for the affected ITP
- **Replace:** read `totalSupply` from `SharesUpdated` event instead
- Write DB snapshot from cache

**New: SharesUpdated handler:**
- Update `total_supply` in `ItpStateCache`
- Update user balance in `UserCache.balances.itp_shares`
- Bump `balances_gen` for SSE push

**Add to abigen:**
```rust
event SharesUpdated(bytes32 indexed itpId, address indexed user, uint256 newTotalSupply, uint256 userNewBalance)
```

### 5. Rewrite `poll_nav_once` — zero RPC

**File:** `data-node/src/chain_pollers.rs` lines 128–243

**Current:** loops all ITPs, calls `getITPState()` per ITP, computes NAV.
**New:** reads inventory from `ItpStateCache`, multiplies by Bitget prices. Pure math.

```rust
pub async fn compute_nav_from_cache(state: &AppState) -> Result<()> {
    let itp_cache = state.itp_states.read().await;
    let live_prices = state.live_cache.tickers.read().await;

    let mut snapshots = Vec::new();
    for (itp_id, itp) in &itp_cache.states {
        let nav = compute_nav(&itp.assets, &itp.inventory, &live_prices, &state.symbol_map);
        let supply_f64 = itp.total_supply.as_u128() as f64 / 1e18;
        snapshots.push(NavSnapshot {
            itp_id: itp_id.clone(),
            name: itp.name.clone(),
            symbol: itp.symbol.clone(),
            nav_per_share: nav,
            total_supply: itp.total_supply.to_string(),
            aum_usd: nav * supply_f64,
            settlement_address: itp.settlement_address.clone(),
        });
    }

    let mut nav = state.chain_cache.nav.write().await;
    *nav = snapshots;
    state.chain_cache.nav_gen.bump();
    Ok(())
}
```

**Keep the 60s poll interval** — but now it's microseconds of CPU, not 90+ RPC calls.

### 6. Rewrite `poll_user_balances_once` — kill O(users × ITPs)

**File:** `data-node/src/chain_pollers.rs` lines 298–392

**Current:** for each user, calls `getUserShares(itpId, user)` for ALL ITPs.
**New:** `SharesUpdated` events push balance changes into `UserCache`. The poller only fetches USDC balances (2 RPC calls per user = O(users)).

```rust
pub async fn poll_user_balances_once(state: &AppState) -> Result<()> {
    // ... same user_list setup ...

    for (user, user_cache) in &user_list {
        // USDC balances — still polled (2 RPC calls, O(users))
        let usdc_bal = usdc.balance_of(*user).call().await.unwrap_or_default();
        let l3_usdc_bal = l3_usdc.balance_of(*user).call().await.unwrap_or_default();
        let bridged_bal = /* vault balance */;

        // ITP shares — READ FROM CACHE, set by SharesUpdated events
        // Don't touch uc.balances.itp_shares here — events maintain it
        let mut uc = user_cache.write().await;
        uc.balances.usdc_settlement = usdc_bal.to_string();
        uc.balances.usdc_l3 = l3_usdc_bal.to_string();
        uc.balances.bridged_itp = bridged_bal.to_string();
        uc.balances_gen.bump();
    }
    Ok(())
}
```

**RPC reduction:** from `N_users × N_itps` to `3 × N_users`.

### 7. Rewrite `poll_user_orders_once` — read from DB, not chain

**File:** `data-node/src/chain_pollers.rs` lines 445–530

**Current:** queries DB for order IDs, then calls `getOrder(orderId)` on-chain per order + scans `FillConfirmed` events.
**New:** the `trades` DB table already has all order data from `OrderSubmitted` events. `FillConfirmed` events already update fill data. Just read from DB.

```rust
pub async fn poll_user_orders_once(state: &AppState) -> Result<()> {
    for (user_addr, user_cache) in &user_list {
        // Query DB only — no RPC calls
        let orders = sqlx::query_as::<_, TradeRow>(
            "SELECT order_id, user_address, itp_id, side, amount, limit_price,
                    status, fill_price, fill_amount, fill_cycle, order_timestamp
             FROM trades WHERE LOWER(user_address) = $1
             AND (status IN (0, 1) OR order_timestamp > NOW() - INTERVAL '5 minutes')
             ORDER BY order_id DESC LIMIT 50"
        ).bind(user_addr).fetch_all(&state.pool).await?;

        let mut uc = user_cache.write().await;
        uc.orders = orders.into_iter().map(|r| r.into()).collect();
        uc.orders_gen.bump();
    }
    Ok(())
}
```

**RPC reduction:** from `2 × active_orders` per user to 0.

### 8. Rewrite `poll_pending_orders_once` / `poll_batched_orders_once`

**File:** `data-node/src/chain_pollers.rs` lines 725–797

**Current:** scans last 100 order IDs on-chain, calls `getOrder()` each.
**New:** query `trades` table filtered by status.

```rust
pub async fn poll_pending_orders_once(state: &AppState) -> Result<()> {
    let pending = sqlx::query_as::<_, TradeRow>(
        "SELECT * FROM trades WHERE status = 0 ORDER BY order_id DESC LIMIT 100"
    ).fetch_all(&state.pool).await?;

    let mut cache = state.chain_cache.pending_orders.write().await;
    *cache = pending.into_iter().map(|r| r.into()).collect();
    state.chain_cache.pending_orders_gen.bump();
    Ok(())
}
```

Same for `poll_batched_orders_once` with `status = 1`.

**RPC reduction:** from 100 `getOrder()` calls per poll to 0.

### 9. Ensure `trades` table is kept current by events

**File:** `data-node/src/itp_collector.rs`

The collector already processes `OrderSubmitted` (line 347–361) and `FillConfirmed` (line 306–344).

**Add listeners for:**
- `OrderCancelled` → update `trades.status = 3` for that orderId
- `OrderRefunded` → update `trades.status = 4` for that orderId
- `StalePendingOrdersCancelled` → bulk update status

These events already exist in EventsLib.sol. The data-node just doesn't listen to them yet.

**Add to abigen in itp_collector.rs:**
```rust
event OrderCancelled(uint256 indexed orderId, address indexed user, uint256 refundAmount)
event OrderRefunded(uint256 indexed orderId, address indexed user, uint256 refundAmount)
```

---

## Frontend Changes

### 10. SSE — delta NAV updates

**File:** `data-node/src/api.rs` SSE dispatch (line ~6207–6213)

Currently broadcasts full `NavSnapshot[]` array on every change.

**Change:** track previous snapshot, send only ITPs whose NAV changed by > 0.01%.

```rust
// In SSE dispatch loop:
if cache.nav_gen.is_dirty() {
    let current = cache.nav.read().await;
    let delta: Vec<&NavSnapshot> = current.iter()
        .filter(|s| has_changed(s, &previous_nav))
        .collect();
    if !delta.is_empty() {
        yield Event::default().event("itp-nav-delta").data(json!(delta));
    }
    previous_nav = current.clone();
}
```

**File:** `frontend/hooks/useSSE.tsx` (line ~240–251)

Add handler for `itp-nav-delta` that merges into existing array instead of replacing.

```typescript
// New delta handler
eventSource.addEventListener('itp-nav-delta', (e) => {
    const delta: NavSnapshot[] = JSON.parse(e.data);
    setItpNav(prev => {
        const map = new Map(prev.map(s => [s.itp_id, s]));
        delta.forEach(s => map.set(s.itp_id, s));
        return Array.from(map.values());
    });
});
```

Keep the full `itp-nav` event for initial connection (client receives full state on connect, then deltas).

### 11. Name cache — batch warm-up

**File:** `data-node/src/chain_pollers.rs` lines 210–237

**Current:** caps at 10 new names per poll. 1000 ITPs = 100 seconds to warm.
**New:** warm all names at startup (parallel batches of 50), remove the cap.

```rust
// At startup, after hydrating itp_states:
let uncached: Vec<u64> = (1..=count).collect();
for chunk in uncached.chunks(50) {
    let futs = chunk.iter().map(|i| async {
        let (name, symbol) = reader.get_itp_name_symbol(id).call().await?;
        let settlement = bridge_proxy.get_bridged_itp(id).call().await.ok();
        Ok((*i, name, symbol, settlement))
    });
    let results = futures::future::join_all(futs).await;
    // insert into ITP_NAME_CACHE
}
```

---

## AUM Ranking

### 12. Precompute and cache

**File:** `data-node/src/api.rs` lines 1312–1850

**Current:** computes on every request, scans all snapshots.
**New:** background task computes AUM ranking every 60s from cache, serves from memory.

**File:** `data-node/src/main.rs`

Add new poller:
```rust
spawn_poller!("aum_ranking", 60, || compute_aum_ranking(&state));
```

The endpoint reads from `chain_cache.aum_ranking` instead of computing.

---

## System Snapshot / Vault Snapshot

### 13. Vault token scan — bounded

**File:** `data-node/src/api.rs` lines 6083–6141

**Current:** loops all unique token addresses across vault.
**New:** cache vault balances, update only on fill events (vault balance only changes when AP deposits/withdraws tokens).

Not critical for 1000 ITPs (vault tokens grow slowly), but worth capping.

---

## Summary — RPC Budget After Changes

| Poller | Before (90 ITPs) | After (1000 ITPs) |
|--------|-------------------|-------------------|
| `poll_nav_once` (60s) | 90 RPC | **0 RPC** (cache math) |
| `poll_user_balances_once` (1s) | N×90 RPC | **3×N RPC** (USDC only) |
| `poll_user_orders_once` (1s) | 2×orders RPC | **0 RPC** (DB query) |
| `poll_pending_orders_once` (1s) | 100 RPC | **0 RPC** (DB query) |
| `poll_batched_orders_once` (2s) | 100 RPC | **0 RPC** (DB query) |
| `itp_collector` periodic (300s) | 90 RPC | **0 RPC** (cache→DB) |
| `itp_collector` events | 1 RPC/event | **0 RPC** (event data) |
| Startup hydration | 90 sequential | **1000 parallel** (2s) |
| **Total steady-state/min** | **~15,000** | **~180** (USDC only) |

---

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `contracts/src/libraries/EventsLib.sol` | Add `SharesUpdated` event |
| 2 | `contracts/src/core/Investment.sol` | Emit `SharesUpdated` at 7 totalSupply mutation sites |
| 3 | `data-node/src/chain_cache.rs` | Add `ItpStateCache` struct |
| 4 | `data-node/src/itp_collector.rs` | Parallel startup, event-only updates, cache writes, listen to cancel/refund events |
| 5 | `data-node/src/chain_pollers.rs` | Rewrite `poll_nav_once`, `poll_user_balances_once`, `poll_user_orders_once`, `poll_pending_orders_once`, `poll_batched_orders_once` |
| 6 | `data-node/src/api.rs` | SSE delta broadcasts, precomputed AUM ranking endpoint, cache-based vault snapshot |
| 7 | `data-node/src/main.rs` | Add AUM ranking poller, adjust intervals |
| 8 | `frontend/hooks/useSSE.tsx` | Handle `itp-nav-delta` merge |
| 9 | `data-node/src/db.rs` | Queries for order status reads (if not already there) |

---

## Deployment Order

1. **Contract** — deploy with `SharesUpdated` event (backward compatible, just adds an event)
2. **Data-node** — deploy new version (parallel startup + event handlers + cache-only pollers)
3. **Frontend** — deploy SSE delta handler (backward compatible, still handles full `itp-nav`)

Steps 2 and 3 can deploy independently. Step 1 must precede step 2.

---

## Additional Bottlenecks (Full Audit)

10 parallel agents audited every layer. Below are all additional bottlenecks beyond the core RPC polling fix.

### Contract — O(n) Loops

| Function | File:Line | Pattern | At 1000 ITPs | Fix |
|----------|-----------|---------|-------------|-----|
| `getItpInfo()` | Investment.sol:895 | Linear scan `_allItpIds` for vault address | O(1000) per call | Add `mapping(address => bytes32) vault2Id` reverse lookup |
| `getItpPrice()` | Investment.sol:917 | Same linear scan | O(1000) per call | Same reverse mapping |
| `getAllItps()` | Investment.sol:861 | Allocates + iterates all ITP vaults | ~100k gas | Cache off-chain, call only on ITP creation events |
| `createITP()` duplicate check | Investment.sol:689 | O(assets²) nested loop | Bounded by MAX_ASSETS=1000 | Acceptable (one-time per ITP) |

### Database — Missing Indexes & Slow Queries

| Query | File:Line | Issue | Fix |
|-------|-----------|-------|-----|
| `trades` by user | chain_pollers.rs:463 | `LOWER(user_address)` breaks index | Store addresses lowercase, drop `LOWER()` |
| `trades` by status | chain_pollers.rs:733 | No index on `(status, order_id)` | Add `idx_trades_status_order` |
| Health stats 7-day scan | api.rs:167 | Scans 15-30M rows in `market_prices` | Materialized view or pre-aggregated table |
| Batch settlements threshold | batch_engine.rs:260 | `GROUP BY asset_id` + JOIN on unbounded table | Add temporal pruning (archive >90 days) |
| `itp_snapshots` array columns | db.rs:436 | Each row carries full TEXT[] arrays (~7KB) | Consider normalized `itp_snapshot_assets` table |

### Frontend — Rendering

| Component | File | Issue | Fix |
|-----------|------|-------|-----|
| ItpListing filter/sort | ItpListing.tsx:101 | Client-side `.filter().sort()` on full 1000-item array per keystroke | Debounce search, server-side filtering |
| Home page SEO section | page.tsx:36 | Maps all 1000 ITPs as `<article>` elements | Paginate or limit to top 50 by AUM |
| SSE full-array re-render | useSSE.tsx:243 | `setItpNav(parsed)` replaces full array → re-renders all consumers | Delta updates (covered in Section 10) |
| VisionLeaderboard | VisionLeaderboard.tsx:49 | `.map()` over unbounded leaderboard, no virtualization | Add pagination or TanStack Virtual |
| MarketsTable | MarketsTable.tsx:298 | "Show more" keeps adding DOM nodes (100, 300, 500...) | Virtual scrolling |

### SSE & Streaming

| Issue | File:Line | Impact | Fix |
|-------|-----------|--------|-----|
| No backpressure | api.rs:6189 | Slow clients block spawned task (mpsc capacity 16) | Drop slow clients after N missed events |
| No reconnect jitter | useSSE.tsx:219 | Thundering herd on data-node restart | Add randomized jitter to backoff |
| User cache never evicted | chain_cache.rs:229 | 10K users × 20KB = 200MB unbounded growth | Add TTL or LRU eviction (30min inactive) |
| Vision WS broadcast overflow | vision_ws.rs:53 | `broadcast::channel(16)` drops silently when lagged | Increase capacity to 256, add resync mechanism |
| Full `itp-nav` payload | api.rs:6209 | 1000 ITPs × 300B = 300KB per event × 4/sec = 1.2MB/s/client | Delta updates (covered) |

### Issuer — Consensus & Recovery

| Issue | File:Line | Impact at 1000 ITPs | Fix |
|-------|-----------|---------------------|-----|
| Sequential `setItpNav` BLS consensus | protocol.rs:6191 | 1000 ITPs × 300ms timeout = 300s per cycle | Batch ITPs into single consensus proposal |
| Delisting watchdog | delisting_watchdog.rs:106 | 1000 sequential `getITPState` calls daily | Read from data-node cache API instead |
| State reconstruction at startup | reconstruction.rs:270 | 1000 sequential RPC + 5000 collateral checks (×5 chains) | Parallel batches of 50 + cache snapshot |
| Pending mints linear scan | settlement_reader.rs:740 | Scans ALL order IDs on crash recovery | Event-based tracking, not polling |
| Vision snapshot timeout | engine.rs:286 | 5s HTTP timeout already exceeded at 90 ITPs | Increase timeout, paginate response |

### Vision — Batch/Market Scaling

| Issue | File:Line | Complexity | Fix |
|-------|-----------|-----------|-----|
| Leaderboard aggregation | vision/api.rs:966 | O(batches × players) per request | Precompute in background, cache |
| List batches + TVL | vision/api.rs:218 | O(batches × players) for balance sums | Cache TVL per batch, update on events |
| Batch history | vision/api.rs:381 | 256 markets × 1000 ticks = 256K rows | Paginate, add `LIMIT` |
| Tick resolver | vision/resolver.rs:118 | O(markets × players) per tick resolution | Acceptable but monitor at scale |
| Batch config cache refresh | vision_batch_cache.rs:82 | Sequential HTTP per batch | Parallel fetches with `join_all` |
| WebSocket subscription filtering | vision_ws.rs:146 | O(subscriptions × markets) per broadcast | Index subscriptions by source |

### Bridge & Settlement

| Issue | File:Line | Impact | Fix |
|-------|-----------|--------|-----|
| Pending creations polling | chain_pollers.rs:903 | Scans 0..nextCreationNonce per poll | Event-based, listen for BridgeCreateCompleted |
| Cross-chain order enrichment | chain_pollers.rs:960 | 1 RPC per event to get full order data | Batch enrichment or store from event |

### API Response Sizes

| Endpoint | Current Size | At 1000 ITPs | Fix |
|----------|-------------|-------------|-----|
| `/aum-ranking` | ~200KB | 8MB+ (10s timeout) | Precompute in background |
| `/nav-series` | ~50KB | Unbounded (no max range) | Add 90-day max range |
| `/snapshot` (market) | ~5MB | 12MB+ (no compression) | Enforce gzip, reduce default limit |
| `/portfolio` | ~20KB | N+1 DB queries (500 ITPs = 500 queries) | Batch DB query |
| `/portfolio/trades` | ~10KB | Unbounded (no pagination) | Add `LIMIT` + pagination |
| `/chain/l3/batched-orders` | ~5KB | Unbounded growth (never pruned) | Add retention/pruning |

### Config & Limits

| Item | File:Line | Current | At 1000 ITPs | Fix |
|------|-----------|---------|-------------|-----|
| System snapshot timeout | chain_pollers.rs:1115 | 120s | Still exceeded | Dynamic: `60 + (itp_count / 10)` |
| Name cache batch cap | chain_pollers.rs:212 | `.take(10)` | 100 polls to warm | `.take(100)` or warm at startup |
| Deploy script structure | Deploy107ITPs_Create.s.sol | Named batch functions | File too large at >200 ITPs | Loop-based generation |

---

## Files to Modify (Complete)

| # | File | Change | Priority |
|---|------|--------|----------|
| 1 | `contracts/src/libraries/EventsLib.sol` | Add `SharesUpdated` event | P0 |
| 2 | `contracts/src/core/Investment.sol` | Emit `SharesUpdated` at 7 sites + add `vault2Id` reverse mapping | P0 |
| 3 | `data-node/src/chain_cache.rs` | Add `ItpStateCache` struct, user cache TTL eviction | P0 |
| 4 | `data-node/src/itp_collector.rs` | Parallel startup, event-only updates, listen to cancel/refund/SharesUpdated | P0 |
| 5 | `data-node/src/chain_pollers.rs` | Rewrite 5 pollers to cache/DB reads, parallel name warm-up | P0 |
| 6 | `data-node/src/api.rs` | SSE delta broadcasts, precomputed AUM, add backpressure | P1 |
| 7 | `data-node/src/main.rs` | Add AUM ranking poller | P1 |
| 8 | `frontend/hooks/useSSE.tsx` | Delta merge handler, reconnect jitter | P1 |
| 9 | `data-node/src/db.rs` | Add missing indexes, lowercase user addresses | P1 |
| 10 | `frontend/components/domain/ItpListing.tsx` | Debounced search, server-side filtering | P2 |
| 11 | `frontend/app/[locale]/index/page.tsx` | Limit SEO section to top 50 ITPs | P2 |
| 12 | `data-node/src/vision_batch_cache.rs` | Parallel config fetches | P2 |
| 13 | `data-node/src/vision_ws.rs` | Increase broadcast capacity, index subscriptions | P2 |
| 14 | `issuer/src/consensus/protocol.rs` | Batch `setItpNav` consensus | P2 |
| 15 | `issuer/src/state/reconstruction.rs` | Parallel startup hydration | P2 |
| 16 | `issuer/src/delisting_watchdog.rs` | Read from data-node cache | P3 |
| 17 | `issuer/src/vision/api.rs` | Precompute leaderboard, paginate batch state | P3 |
| 18 | `data-node/src/batch_engine.rs` | Temporal pruning of batch_settlements | P3 |

---

## Deployment Order (Revised)

1. **Contract** — deploy `SharesUpdated` event + `vault2Id` reverse mapping
2. **Database** — add missing indexes (zero downtime, can run during deploy)
3. **Data-node** — deploy event-driven cache + rewritten pollers + SSE deltas
4. **Frontend** — deploy delta SSE handler + UI pagination
5. **Issuer** — deploy parallel startup + batched consensus (can follow independently)

Steps 2-4 can deploy in parallel. Step 1 must precede step 3.
