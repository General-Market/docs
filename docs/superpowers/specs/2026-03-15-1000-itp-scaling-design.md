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
