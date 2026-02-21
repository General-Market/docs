# SSE Chain Reads Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move all 21 frontend blockchain reads into the data-node and expose them via a single multiplexed SSE stream, eliminating direct RPC calls from the browser.

**Architecture:** Data-node maintains an in-memory `ChainCache` updated by per-topic poller tasks (1-5s intervals). A single SSE endpoint `/sse/stream` accepts `topics` + `address` query params. Per-client dispatcher task loops over subscribed topics, diffs against last-sent generation, and pushes only changed data. Frontend replaces all wagmi/viem reads with a shared `useSSE` React context.

**Tech Stack:** Rust (axum SSE, ethers-rs, tokio), TypeScript (React context + EventSource), existing data-node + frontend.

---

## Task 1: ChainCache module — global cache types and skeleton

**Files:**
- Create: `data-node/src/chain_cache.rs`
- Modify: `data-node/src/main.rs` (add `mod chain_cache`)

**Step 1: Create the cache module with types**

```rust
// data-node/src/chain_cache.rs
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use ethers::types::{Address, U256};
use serde::Serialize;

/// Generation counter — bumped on every cache write. SSE dispatcher compares
/// its last-sent generation against the cache generation to detect changes.
#[derive(Default)]
pub struct Generation(AtomicU64);

impl Generation {
    pub fn bump(&self) -> u64 { self.0.fetch_add(1, Ordering::Relaxed) + 1 }
    pub fn get(&self) -> u64 { self.0.load(Ordering::Relaxed) }
}

// ── Global data (same for all clients) ──

#[derive(Clone, Serialize, Default)]
pub struct NavSnapshot {
    pub itp_id: String,
    pub nav_per_share: f64,
    pub total_supply: String,   // U256 as decimal string
    pub aum_usd: f64,
}

#[derive(Clone, Serialize, Default)]
pub struct OracleSnapshot {
    pub price: String,          // U256 as decimal string
    pub last_updated: u64,
    pub last_cycle: u64,
}

// ── Per-user data ──

#[derive(Clone, Serialize, Default)]
pub struct UserBalances {
    pub usdc_l3: String,         // L3 WUSDC balance (18 dec)
    pub usdc_arb: String,        // ARB USDC balance (6 dec)
    pub itp_shares: String,      // L3 Index shares (18 dec)
    pub bridged_itp: String,     // ARB BridgedITP balance (18 dec)
    pub itp_nonce: u64,          // L3 tx nonce
}

#[derive(Clone, Serialize, Default)]
pub struct UserAllowances {
    pub usdc_l3_to_index: String,
    pub usdc_arb_to_custody: String,
    pub itp_to_morpho: String,
}

#[derive(Clone, Serialize, Default)]
pub struct UserOrder {
    pub order_id: u64,
    pub user: String,
    pub side: u8,
    pub amount: String,
    pub limit_price: String,
    pub itp_id: String,
    pub timestamp: u64,
    pub status: u8,
    pub fill_price: Option<String>,
    pub fill_amount: Option<String>,
    pub fill_cycle: Option<u64>,
}

#[derive(Clone, Serialize, Default)]
pub struct MorphoPositionSnapshot {
    pub supply_shares: String,
    pub borrow_shares: String,
    pub collateral: String,
}

#[derive(Clone, Serialize, Default)]
pub struct FillRecord {
    pub order_id: u64,
    pub side: u8,
    pub fill_price: String,
    pub fill_amount: String,
    pub limit_price: String,
}

#[derive(Clone, Serialize, Default)]
pub struct UserCostBasis {
    pub total_cost: String,
    pub total_shares_bought: String,
    pub avg_cost_per_share: String,
    pub total_sell_proceeds: String,
    pub total_shares_sold: String,
    pub realized_pnl: String,
    pub fills: Vec<FillRecord>,
}

#[derive(Default)]
pub struct UserCache {
    pub balances: UserBalances,
    pub balances_gen: Generation,
    pub allowances: UserAllowances,
    pub allowances_gen: Generation,
    pub orders: Vec<UserOrder>,
    pub orders_gen: Generation,
    pub positions: MorphoPositionSnapshot,
    pub positions_gen: Generation,
    pub cost_basis: UserCostBasis,
    pub cost_basis_gen: Generation,
}

pub struct ChainCache {
    // Global
    pub nav: RwLock<Vec<NavSnapshot>>,
    pub nav_gen: Generation,
    pub oracle: RwLock<OracleSnapshot>,
    pub oracle_gen: Generation,
    // SystemStatus already exists in build_system_snapshot — we'll reuse it

    // Per-user: address (lowercase hex) → user cache
    pub users: RwLock<HashMap<String, Arc<RwLock<UserCache>>>>,
}

impl ChainCache {
    pub fn new() -> Self {
        Self {
            nav: RwLock::new(Vec::new()),
            nav_gen: Generation::default(),
            oracle: RwLock::new(OracleSnapshot::default()),
            oracle_gen: Generation::default(),
            users: RwLock::new(HashMap::new()),
        }
    }

    /// Get or create a user cache entry. Called when a client subscribes with an address.
    pub async fn get_or_create_user(&self, address: &str) -> Arc<RwLock<UserCache>> {
        let addr = address.to_lowercase();
        {
            let users = self.users.read().await;
            if let Some(u) = users.get(&addr) {
                return Arc::clone(u);
            }
        }
        let mut users = self.users.write().await;
        let entry = users.entry(addr).or_insert_with(|| Arc::new(RwLock::new(UserCache::default())));
        Arc::clone(entry)
    }
}
```

**Step 2: Register module in main.rs**

Add `mod chain_cache;` to `data-node/src/main.rs` alongside other module declarations.

**Step 3: Compile to verify**

Run: `cargo check -p data-node`
Expected: compiles with no errors

**Step 4: Commit**

```bash
git add data-node/src/chain_cache.rs data-node/src/main.rs
git commit -m "feat(data-node): add ChainCache module with types for SSE stream"
```

---

## Task 2: Global pollers — NAV + Oracle

**Files:**
- Create: `data-node/src/chain_pollers.rs`
- Modify: `data-node/src/main.rs` (spawn pollers)
- Modify: `data-node/src/api.rs` (add `chain_cache` to AppState)

**Step 1: Add ChainCache to AppState**

In `data-node/src/api.rs`, add to `AppState`:
```rust
pub chain_cache: Arc<chain_cache::ChainCache>,
```

In `data-node/src/main.rs`, construct and pass it:
```rust
let chain_cache = Arc::new(chain_cache::ChainCache::new());
// add to AppState { ..., chain_cache: Arc::clone(&chain_cache) }
```

**Step 2: Create global pollers**

```rust
// data-node/src/chain_pollers.rs
use std::sync::Arc;
use std::time::Duration;
use ethers::prelude::*;
use tracing::{info, warn};

use crate::api::AppState;
use crate::chain_cache::{NavSnapshot, OracleSnapshot};

abigen!(
    NavReader,
    r#"[
        function getItpCount() view returns (uint256)
        function getITPState(bytes32 itpId) view returns (address creator, uint256 totalSupply, uint256 nav, address[] assets, uint256[] weights, uint256[] inventory)
    ]"#
);

abigen!(
    OracleReader,
    r#"[
        function currentPrice() view returns (uint256)
        function lastUpdated() view returns (uint256)
        function lastCycleNumber() view returns (uint256)
    ]"#
);

/// Polls ITP NAV every 1s, updates chain_cache.nav
pub async fn poll_nav(state: Arc<AppState>) {
    let interval = Duration::from_secs(1);
    let cache = &state.chain_cache;

    loop {
        if let Err(e) = poll_nav_once(&state, cache).await {
            warn!(%e, "NAV poller error");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn poll_nav_once(
    state: &AppState,
    cache: &crate::chain_cache::ChainCache,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let index_addr = crate::api::deployment_addr(&state.deployment, "Index")?;
    let reader = NavReader::new(index_addr, Arc::clone(&state.l3_provider));

    let count: U256 = reader.get_itp_count().call().await?;
    let mut snapshots = Vec::new();

    for i in 0..count.as_u64() {
        let itp_id_bytes = ethers::utils::keccak256(i.to_be_bytes());
        let (_, total_supply, nav, assets, _weights, inventory) =
            reader.get_itp_state(itp_id_bytes.into()).call().await?;

        // Compute NAV from inventory + prices (uses DB prices like the existing itp_price endpoint)
        let nav_f64 = format_nav(nav);
        let ts = format_u256(total_supply);
        let aum = nav_f64 * parse_u256_f64(total_supply, 18);

        snapshots.push(NavSnapshot {
            itp_id: format!("0x{}", hex::encode(itp_id_bytes)),
            nav_per_share: nav_f64,
            total_supply: ts,
            aum_usd: aum,
        });
    }

    let mut nav = cache.nav.write().await;
    *nav = snapshots;
    cache.nav_gen.bump();
    Ok(())
}

/// Polls Morpho oracle every 2s
pub async fn poll_oracle(state: Arc<AppState>) {
    let interval = Duration::from_secs(2);
    let cache = &state.chain_cache;

    loop {
        if let Err(e) = poll_oracle_once(&state, cache).await {
            warn!(%e, "Oracle poller error");
        }
        tokio::time::sleep(interval).await;
    }
}

async fn poll_oracle_once(
    state: &AppState,
    cache: &crate::chain_cache::ChainCache,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let oracle_addr = crate::api::deployment_addr(&state.morpho_deployment, "MOCK_ORACLE")?;
    let reader = OracleReader::new(oracle_addr, Arc::clone(&state.arb_provider));

    let (price, updated, cycle) = tokio::join!(
        reader.current_price().call(),
        reader.last_updated().call(),
        reader.last_cycle_number().call(),
    );

    let mut oracle = cache.oracle.write().await;
    *oracle = OracleSnapshot {
        price: format_u256(price?),
        last_updated: updated?.as_u64(),
        last_cycle: cycle?.as_u64(),
    };
    cache.oracle_gen.bump();
    Ok(())
}

fn format_u256(v: U256) -> String { v.to_string() }
fn format_nav(v: U256) -> f64 { v.as_u128() as f64 / 1e18 }
fn parse_u256_f64(v: U256, decimals: u32) -> f64 { v.as_u128() as f64 / 10f64.powi(decimals as i32) }
```

**Step 3: Spawn pollers in main.rs**

After `AppState` creation, before HTTP server:
```rust
// Spawn chain pollers
let poll_state = Arc::clone(&app_state);
tokio::spawn(chain_pollers::poll_nav(Arc::clone(&poll_state)));
tokio::spawn(chain_pollers::poll_oracle(Arc::clone(&poll_state)));
info!("Chain pollers started (NAV=1s, Oracle=2s)");
```

**Step 4: Make deployment_addr public**

In `api.rs`, ensure `deployment_addr` is `pub(crate)` or `pub` so `chain_pollers.rs` can call it.

**Step 5: Compile**

Run: `cargo check -p data-node`
Expected: compiles

**Step 6: Commit**

```bash
git add data-node/src/chain_pollers.rs data-node/src/main.rs data-node/src/api.rs
git commit -m "feat(data-node): add NAV + Oracle global pollers for SSE cache"
```

---

## Task 3: Per-user pollers — balances, allowances, orders

**Files:**
- Modify: `data-node/src/chain_pollers.rs` (add user poller functions)

**Step 1: Add user balance poller**

```rust
/// Polls balances for all active users every 1s
pub async fn poll_user_balances(state: Arc<AppState>) {
    let interval = Duration::from_secs(1);
    loop {
        let users = state.chain_cache.users.read().await;
        for (addr, user_cache) in users.iter() {
            if let Err(e) = poll_user_balances_once(&state, addr, user_cache).await {
                warn!(%e, addr, "User balance poller error");
            }
        }
        drop(users);
        tokio::time::sleep(interval).await;
    }
}
```

Add `poll_user_balances_once` reading:
- L3 WUSDC `balanceOf(user)` via `state.l3_provider`
- ARB USDC `balanceOf(user)` via `state.arb_provider`
- L3 Index `getUserShares(itpId, user)` via `state.l3_provider`
- ARB BridgedITP `balanceOf(user)` via `state.arb_provider`

Use the same `ERC20Reader` abigen pattern. Update `user_cache.balances` + bump `balances_gen`.

**Step 2: Add user allowances poller (3s)**

Same pattern — reads `allowance(user, spender)` for USDC→Index, USDC→ArbCustody, ITP→Morpho.

**Step 3: Add user orders poller (1s)**

Read active orders from the Index contract (reuse the existing `order()` API handler pattern — `getOrder(orderId)` for each active order tracked). Use the DB `trades` table to know which order IDs belong to which user.

**Step 4: Spawn in main.rs**

```rust
tokio::spawn(chain_pollers::poll_user_balances(Arc::clone(&poll_state)));
tokio::spawn(chain_pollers::poll_user_allowances(Arc::clone(&poll_state)));
tokio::spawn(chain_pollers::poll_user_orders(Arc::clone(&poll_state)));
info!("User pollers started (balances=1s, allowances=3s, orders=1s)");
```

**Step 5: Compile + commit**

```bash
cargo check -p data-node
git add data-node/src/chain_pollers.rs data-node/src/main.rs
git commit -m "feat(data-node): add per-user pollers (balances, allowances, orders)"
```

---

## Task 4: Per-user pollers — positions + cost-basis

**Files:**
- Modify: `data-node/src/chain_pollers.rs`

**Step 1: Add Morpho position poller (3s)**

Read `position(marketId, user)` from Morpho contract via `state.arb_provider`. Also read MetaMorpho vault `balanceOf(user)`, `totalAssets()`, `totalSupply()`.

Update `user_cache.positions` + bump `positions_gen`.

**Step 2: Add cost-basis poller (5s)**

Query `OrderSubmitted` + `FillConfirmed` events from L3 Index contract for the user. This is the heavy one — use `fromBlock` tracking:

- On first run, scan from block 0 (or earliest known deployment block)
- Cache the last scanned block number per user
- On subsequent runs, only scan from last block + 1

Compute VWAP cost basis (same math as frontend `useItpCostBasis`). Update `user_cache.cost_basis` + bump `cost_basis_gen`.

**Step 3: Compile + commit**

```bash
cargo check -p data-node
git add data-node/src/chain_pollers.rs
git commit -m "feat(data-node): add Morpho position + cost-basis pollers"
```

---

## Task 5: SSE multiplexed stream endpoint

**Files:**
- Modify: `data-node/src/api.rs` (add `/sse/stream` route + handler)

**Step 1: Add route**

In `router()`, add:
```rust
.route("/sse/stream", get(sse_stream))
```

**Step 2: Implement the handler**

```rust
#[derive(Deserialize)]
struct StreamQuery {
    topics: String,           // comma-separated: "system,nav,balances,orders"
    address: Option<String>,  // required for user topics
}

async fn sse_stream(
    State(state): State<Arc<AppState>>,
    Query(params): Query<StreamQuery>,
) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let topics: Vec<String> = params.topics.split(',').map(|s| s.trim().to_string()).collect();
    let address = params.address.map(|a| a.to_lowercase());

    // Register user in cache if address-dependent topics requested
    let user_cache = if let Some(ref addr) = address {
        let has_user_topic = topics.iter().any(|t|
            matches!(t.as_str(), "balances" | "allowances" | "orders" | "positions" | "cost-basis")
        );
        if has_user_topic {
            Some(state.chain_cache.get_or_create_user(addr).await)
        } else {
            None
        }
    } else {
        None
    };

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, std::convert::Infallible>>(16);

    tokio::spawn(async move {
        // Track last-sent generation per topic
        let mut last_nav_gen: u64 = 0;
        let mut last_oracle_gen: u64 = 0;
        let mut last_system_gen: u64 = 0;
        let mut last_bal_gen: u64 = 0;
        let mut last_allow_gen: u64 = 0;
        let mut last_orders_gen: u64 = 0;
        let mut last_pos_gen: u64 = 0;
        let mut last_cb_gen: u64 = 0;

        loop {
            let cache = &state.chain_cache;

            // Global topics
            if topics.contains(&"nav".to_string()) {
                let gen = cache.nav_gen.get();
                if gen != last_nav_gen {
                    let data = cache.nav.read().await;
                    let json = serde_json::to_string(&*data).unwrap_or_default();
                    if tx.send(Ok(Event::default().event("itp-nav").data(json))).await.is_err() { break; }
                    last_nav_gen = gen;
                }
            }

            if topics.contains(&"oracle".to_string()) {
                let gen = cache.oracle_gen.get();
                if gen != last_oracle_gen {
                    let data = cache.oracle.read().await;
                    let json = serde_json::to_string(&*data).unwrap_or_default();
                    if tx.send(Ok(Event::default().event("oracle-prices").data(json))).await.is_err() { break; }
                    last_oracle_gen = gen;
                }
            }

            if topics.contains(&"system".to_string()) {
                // Reuse existing build_system_snapshot
                let snapshot = build_system_snapshot(&state).await;
                let json = serde_json::to_string(&snapshot).unwrap_or_default();
                if tx.send(Ok(Event::default().event("system-status").data(json))).await.is_err() { break; }
            }

            // User topics
            if let Some(ref uc) = user_cache {
                let u = uc.read().await;

                if topics.contains(&"balances".to_string()) {
                    let gen = u.balances_gen.get();
                    if gen != last_bal_gen {
                        let json = serde_json::to_string(&u.balances).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-balances").data(json))).await.is_err() { break; }
                        last_bal_gen = gen;
                    }
                }

                if topics.contains(&"allowances".to_string()) {
                    let gen = u.allowances_gen.get();
                    if gen != last_allow_gen {
                        let json = serde_json::to_string(&u.allowances).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-allowances").data(json))).await.is_err() { break; }
                        last_allow_gen = gen;
                    }
                }

                if topics.contains(&"orders".to_string()) {
                    let gen = u.orders_gen.get();
                    if gen != last_orders_gen {
                        let json = serde_json::to_string(&u.orders).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-orders").data(json))).await.is_err() { break; }
                        last_orders_gen = gen;
                    }
                }

                if topics.contains(&"positions".to_string()) {
                    let gen = u.positions_gen.get();
                    if gen != last_pos_gen {
                        let json = serde_json::to_string(&u.positions).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-positions").data(json))).await.is_err() { break; }
                        last_pos_gen = gen;
                    }
                }

                if topics.contains(&"cost-basis".to_string()) {
                    let gen = u.cost_basis_gen.get();
                    if gen != last_cb_gen {
                        let json = serde_json::to_string(&u.cost_basis).unwrap_or_default();
                        if tx.send(Ok(Event::default().event("user-cost-basis").data(json))).await.is_err() { break; }
                        last_cb_gen = gen;
                    }
                }
            }

            // Dispatch loop interval: 250ms (fast enough to catch 1s poller updates promptly)
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    });

    Sse::new(ReceiverStream::new(rx))
        .keep_alive(axum::response::sse::KeepAlive::default())
}
```

**Step 3: Compile + test manually**

Run: `cargo check -p data-node`
Then build and start: `cargo build --release -p data-node && ./target/release/data-node serve ...`
Test: `curl -N "http://localhost:8200/sse/stream?topics=nav,system"`
Expected: receive `event: itp-nav` and `event: system-status` JSON events

**Step 4: Commit**

```bash
git add data-node/src/api.rs
git commit -m "feat(data-node): add /sse/stream multiplexed SSE endpoint"
```

---

## Task 6: Frontend SSEProvider + useSSE hook

**Files:**
- Create: `frontend/hooks/useSSE.tsx`
- Modify: `frontend/app/client-providers.tsx` (wrap with SSEProvider)

**Step 1: Create the SSE hook + provider**

```tsx
// frontend/hooks/useSSE.tsx
'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { DATA_NODE_URL } from '@/lib/config'

// ── Event payload types ──

export interface NavSnapshot {
  itp_id: string
  nav_per_share: number
  total_supply: string
  aum_usd: number
}

export interface OracleSnapshot {
  price: string
  last_updated: number
  last_cycle: number
}

export interface UserBalances {
  usdc_l3: string
  usdc_arb: string
  itp_shares: string
  bridged_itp: string
  itp_nonce: number
}

export interface UserAllowances {
  usdc_l3_to_index: string
  usdc_arb_to_custody: string
  itp_to_morpho: string
}

export interface UserOrder {
  order_id: number
  user: string
  side: number
  amount: string
  limit_price: string
  itp_id: string
  timestamp: number
  status: number
  fill_price: string | null
  fill_amount: string | null
  fill_cycle: number | null
}

export interface MorphoPositionSnapshot {
  supply_shares: string
  borrow_shares: string
  collateral: string
}

export interface FillRecord {
  order_id: number
  side: number
  fill_price: string
  fill_amount: string
  limit_price: string
}

export interface UserCostBasis {
  total_cost: string
  total_shares_bought: string
  avg_cost_per_share: string
  total_sell_proceeds: string
  total_shares_sold: string
  realized_pnl: string
  fills: FillRecord[]
}

// Re-export SystemSnapshot from existing hook
export type { SystemSnapshot } from './useSystemStatusSSE'

// ── SSE State ──

export interface SSEData {
  itpNav: NavSnapshot[]
  oraclePrices: OracleSnapshot | null
  systemStatus: import('./useSystemStatusSSE').SystemSnapshot | null
  userBalances: UserBalances | null
  userAllowances: UserAllowances | null
  userOrders: UserOrder[]
  userPositions: MorphoPositionSnapshot | null
  userCostBasis: UserCostBasis | null
}

export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface SSEContextValue {
  data: SSEData
  state: SSEConnectionState
  isConnected: boolean
}

const defaultData: SSEData = {
  itpNav: [],
  oraclePrices: null,
  systemStatus: null,
  userBalances: null,
  userAllowances: null,
  userOrders: [],
  userPositions: null,
  userCostBasis: null,
}

const SSEContext = createContext<SSEContextValue>({
  data: defaultData,
  state: 'disconnected',
  isConnected: false,
})

// ── Provider ──

interface SSEProviderProps {
  children: ReactNode
  topics: string[]
  address?: string
}

export function SSEProvider({ children, topics, address }: SSEProviderProps) {
  const [data, setData] = useState<SSEData>(defaultData)
  const [connState, setConnState] = useState<SSEConnectionState>('disconnected')
  const esRef = useRef<EventSource | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout | null>(null)
  const attemptRef = useRef(0)

  const topicsStr = useMemo(() => topics.sort().join(','), [topics])

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close()
    setConnState('connecting')

    const params = new URLSearchParams({ topics: topicsStr })
    if (address) params.set('address', address)
    const url = `${DATA_NODE_URL}/sse/stream?${params}`

    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('itp-nav', (e: MessageEvent) => {
      try {
        const parsed: NavSnapshot[] = JSON.parse(e.data)
        setData(prev => ({ ...prev, itpNav: parsed }))
        setConnState('connected')
        attemptRef.current = 0
      } catch {}
    })

    es.addEventListener('oracle-prices', (e: MessageEvent) => {
      try {
        setData(prev => ({ ...prev, oraclePrices: JSON.parse(e.data) }))
      } catch {}
    })

    es.addEventListener('system-status', (e: MessageEvent) => {
      try {
        setData(prev => ({ ...prev, systemStatus: JSON.parse(e.data) }))
        setConnState('connected')
        attemptRef.current = 0
      } catch {}
    })

    es.addEventListener('user-balances', (e: MessageEvent) => {
      try {
        setData(prev => ({ ...prev, userBalances: JSON.parse(e.data) }))
      } catch {}
    })

    es.addEventListener('user-allowances', (e: MessageEvent) => {
      try {
        setData(prev => ({ ...prev, userAllowances: JSON.parse(e.data) }))
      } catch {}
    })

    es.addEventListener('user-orders', (e: MessageEvent) => {
      try {
        setData(prev => ({ ...prev, userOrders: JSON.parse(e.data) }))
      } catch {}
    })

    es.addEventListener('user-positions', (e: MessageEvent) => {
      try {
        setData(prev => ({ ...prev, userPositions: JSON.parse(e.data) }))
      } catch {}
    })

    es.addEventListener('user-cost-basis', (e: MessageEvent) => {
      try {
        setData(prev => ({ ...prev, userCostBasis: JSON.parse(e.data) }))
      } catch {}
    })

    es.onerror = () => {
      setConnState('error')
      es.close()
      esRef.current = null
      const attempt = ++attemptRef.current
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
      reconnectRef.current = setTimeout(connect, delay)
    }
  }, [topicsStr, address])

  useEffect(() => {
    connect()

    const handleVisibility = () => {
      if (document.hidden) {
        esRef.current?.close()
        esRef.current = null
        if (reconnectRef.current) clearTimeout(reconnectRef.current)
        setConnState('disconnected')
      } else {
        attemptRef.current = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      esRef.current?.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  // Reset user data when address changes
  useEffect(() => {
    setData(prev => ({
      ...prev,
      userBalances: null,
      userAllowances: null,
      userOrders: [],
      userPositions: null,
      userCostBasis: null,
    }))
  }, [address])

  const value = useMemo(() => ({
    data,
    state: connState,
    isConnected: connState === 'connected',
  }), [data, connState])

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>
}

// ── Consumer hooks ──

export function useSSE(): SSEContextValue {
  return useContext(SSEContext)
}

export function useSSENav(): NavSnapshot[] {
  return useContext(SSEContext).data.itpNav
}

export function useSSEBalances(): UserBalances | null {
  return useContext(SSEContext).data.userBalances
}

export function useSSEAllowances(): UserAllowances | null {
  return useContext(SSEContext).data.userAllowances
}

export function useSSEOrders(): UserOrder[] {
  return useContext(SSEContext).data.userOrders
}

export function useSSEPositions(): MorphoPositionSnapshot | null {
  return useContext(SSEContext).data.userPositions
}

export function useSSECostBasis(): UserCostBasis | null {
  return useContext(SSEContext).data.userCostBasis
}

export function useSSESystem(): import('./useSystemStatusSSE').SystemSnapshot | null {
  return useContext(SSEContext).data.systemStatus
}

export function useSSEOracle(): OracleSnapshot | null {
  return useContext(SSEContext).data.oraclePrices
}

export function useSSEConnectionState(): SSEConnectionState {
  return useContext(SSEContext).state
}
```

**Step 2: Integrate SSEProvider into client-providers**

In `frontend/app/client-providers.tsx`, wrap children with `SSEProvider`:

```tsx
import { SSEProvider } from '@/hooks/useSSE'

// Inside the component, after useAccount:
const { address } = useAccount()

const topics = useMemo(() => {
  const t = ['system', 'nav', 'oracle']
  if (address) t.push('balances', 'allowances', 'orders', 'positions', 'cost-basis')
  return t
}, [address])

return (
  <SSEProvider topics={topics} address={address}>
    {children}
  </SSEProvider>
)
```

Note: `SSEProvider` must be INSIDE the wagmi provider so `useAccount` works. Check the existing provider nesting order.

**Step 3: Verify build**

Run: `cd frontend && npx next build`
Expected: compiles with no TS errors

**Step 4: Commit**

```bash
git add frontend/hooks/useSSE.tsx frontend/app/client-providers.tsx
git commit -m "feat(frontend): add SSEProvider + useSSE hooks for multiplexed stream"
```

---

## Task 7: Migrate useSystemStatusSSE → useSSESystem

**Files:**
- Modify: `frontend/components/domain/SystemStatusSection.tsx`
- Modify: any other consumer of `useSystemStatusSSE`

**Step 1: Find all consumers**

Search for `useSystemStatusSSE` imports. Replace with `useSSESystem` from `@/hooks/useSSE`.

The existing `useSystemStatusSSE` hook becomes dead code — keep it for one release as fallback, then delete in a follow-up.

**Step 2: Update SystemStatusSection**

Replace:
```tsx
const { snapshot, isConnected } = useSystemStatusSSE()
```
With:
```tsx
const snapshot = useSSESystem()
const { isConnected } = useSSE()
```

**Step 3: Test manually**

Start frontend dev server, check System Status section renders live data from SSE stream.

**Step 4: Commit**

```bash
git add frontend/components/domain/SystemStatusSection.tsx
git commit -m "refactor(frontend): migrate SystemStatusSection to useSSESystem"
```

---

## Task 8: Migrate balance + allowance hooks

**Files:**
- Modify: `frontend/hooks/useUsdcBalance.ts` — replace `useReadContract` with `useSSEBalances`
- Modify: `frontend/hooks/useUserItpShares.ts` — replace `useReadContract` with `useSSEBalances`
- Modify: `frontend/hooks/useUsdcApproval.ts` — replace `useReadContract` with `useSSEAllowances`
- Modify: `frontend/hooks/useItpApproval.ts` — replace `useReadContract` with `useSSEAllowances`
- Modify: `frontend/hooks/usePortfolio.ts` — remove `readOnChainBalance` (bridged ITP now in SSE)

**Step 1: Rewrite useUsdcBalance**

```tsx
'use client'
import { useSSEBalances } from './useSSE'
import { formatUsdcAmount } from '@/lib/utils/formatters'

export function useUsdcBalance() {
  const balances = useSSEBalances()
  const balance = balances ? BigInt(balances.usdc_l3) : undefined
  const formatted = balance !== undefined ? formatUsdcAmount(balance) : '0.00'
  return { balance, formatted, isLoading: !balances, isError: false, refetch: () => {} }
}
```

**Step 2: Rewrite useUserItpShares**

```tsx
'use client'
import { useSSEBalances } from './useSSE'

export function useUserItpShares(itpId: `0x${string}` | undefined, userAddress: `0x${string}` | undefined) {
  const balances = useSSEBalances()
  const shares = balances ? BigInt(balances.itp_shares) : 0n
  return { shares, isLoading: !balances, error: null, refetch: () => {} }
}
```

**Step 3: Rewrite useUsdcApproval and useItpApproval similarly**

Read from `useSSEAllowances()` instead of `useReadContract`.

**Step 4: Simplify usePortfolio**

Remove the `readOnChainBalance` function and the entire on-chain balance merge block. The bridged ITP balance is now available via `useSSEBalances().bridged_itp`. The portfolio hook only needs to fetch from the data-node REST endpoints.

**Step 5: Verify build + commit**

```bash
cd frontend && npx next build
git add frontend/hooks/useUsdcBalance.ts frontend/hooks/useUserItpShares.ts \
  frontend/hooks/useUsdcApproval.ts frontend/hooks/useItpApproval.ts \
  frontend/hooks/usePortfolio.ts
git commit -m "refactor(frontend): migrate balance + allowance hooks to SSE"
```

---

## Task 9: Migrate useOraclePrice + useItpNav

**Files:**
- Modify: `frontend/hooks/useOraclePrice.ts` — read from `useSSEOracle()`
- Modify: `frontend/hooks/useItpNav.ts` — read from `useSSENav()`

**Step 1: Rewrite useOraclePrice**

```tsx
'use client'
import { useSSEOracle } from './useSSE'

export function useOraclePrice() {
  const oracle = useSSEOracle()
  return {
    price: oracle ? BigInt(oracle.price) : undefined,
    lastUpdated: oracle ? BigInt(oracle.last_updated) : undefined,
    lastCycleNumber: oracle ? BigInt(oracle.last_cycle) : undefined,
    isLoading: !oracle,
  }
}
```

**Step 2: Rewrite useItpNav**

Read from `useSSENav()`, find the matching `itp_id`, return `navPerShare`. Keep the existing interface.

**Step 3: Verify build + commit**

```bash
cd frontend && npx next build
git add frontend/hooks/useOraclePrice.ts frontend/hooks/useItpNav.ts
git commit -m "refactor(frontend): migrate useOraclePrice + useItpNav to SSE"
```

---

## Task 10: Migrate useItpCostBasis + FillSpeedChart

**Files:**
- Modify: `frontend/hooks/useItpCostBasis.ts` — read from `useSSECostBasis()`
- Modify: `frontend/components/domain/FillSpeedChart.tsx` — read from SSE or new REST endpoint

**Step 1: Rewrite useItpCostBasis**

Replace the entire `getLogs` scan with:
```tsx
'use client'
import { useSSECostBasis } from './useSSE'

export function useItpCostBasis(itpId: string | null, userAddress: string | null) {
  const cb = useSSECostBasis()
  // Map SSE data to existing CostBasis interface
  const costBasis = cb ? {
    totalCost: BigInt(cb.total_cost),
    totalSharesBought: BigInt(cb.total_shares_bought),
    avgCostPerShare: BigInt(cb.avg_cost_per_share),
    totalSellProceeds: BigInt(cb.total_sell_proceeds),
    totalSharesSold: BigInt(cb.total_shares_sold),
    realizedPnL: BigInt(cb.realized_pnl),
    fills: cb.fills.map(f => ({
      orderId: BigInt(f.order_id),
      side: f.side,
      fillPrice: BigInt(f.fill_price),
      fillAmount: BigInt(f.fill_amount),
      limitPrice: BigInt(f.limit_price),
    })),
  } : null

  return { costBasis, isLoading: !cb, error: null, refresh: async () => {} }
}
```

**Step 2: Migrate FillSpeedChart**

This component scans ALL OrderSubmitted + FillConfirmed events (not per-user). Add a precomputed fill-speed endpoint to the data-node REST API:

`GET /fill-speed?limit=50` — returns recent fills with timestamps for charting.

The data-node already has this data in the `trades` table. This is a REST endpoint, not SSE (historical data, not live).

**Step 3: Verify build + commit**

```bash
cd frontend && npx next build
git add frontend/hooks/useItpCostBasis.ts frontend/components/domain/FillSpeedChart.tsx
git commit -m "refactor(frontend): migrate cost-basis + fill-speed to SSE/REST"
```

---

## Task 11: Migrate Morpho hooks

**Files:**
- Modify: `frontend/hooks/useMorphoMarkets.ts`
- Modify: `frontend/hooks/useMetaMorphoVault.ts`
- Modify: `frontend/hooks/useMorphoHistory.ts` — eliminate full-chain getLogs scan

**Step 1: useMorphoMarkets + useMetaMorphoVault**

These read vault state (totalAssets, totalSupply, market data). Add to the `positions` SSE topic or create a new `vault` topic. For now, keep these as REST calls to existing data-node endpoints (`/morpho-position`, `/vault-balances`) with polling — these are lower priority than the user-specific reads.

**Step 2: useMorphoHistory**

This scans 4 Morpho events from block 0. Move to data-node: add a `/morpho-history?address=0x...` REST endpoint that queries cached events from the DB. The cost-basis poller pattern (incremental block scanning) can be reused.

**Step 3: Verify build + commit**

```bash
cd frontend && npx next build
git add frontend/hooks/useMorphoMarkets.ts frontend/hooks/useMetaMorphoVault.ts frontend/hooks/useMorphoHistory.ts
git commit -m "refactor(frontend): migrate Morpho hooks to REST/SSE"
```

---

## Task 12: Migrate BuyItpModal + SellItpModal event polling

**Files:**
- Modify: `frontend/components/domain/BuyItpModal.tsx`
- Modify: `frontend/components/domain/SellItpModal.tsx`

**Step 1: Replace event log polling with SSE orders**

Both modals poll `getOrder()` + event logs every 3s during active buy/sell flow. Replace with:
- `useSSEOrders()` for order status tracking
- The SSE stream updates every 1s, faster than the current 3s poll

Remove `createPublicClient` calls and `getLogs` event scanning from both modals. The order status (pending → batched → filled) comes from the `user-orders` SSE event.

For the final mint/transfer detection (ARB side), the orders SSE event should include a `completed` status when the bridge finishes. The data-node poller can detect this by watching the BridgedITP Transfer event.

**Step 2: Remove standalone publicClient creation**

Delete the `l3Client = createPublicClient(...)` and `arbClient = createPublicClient(...)` from both modals.

**Step 3: Verify build + commit**

```bash
cd frontend && npx next build
git add frontend/components/domain/BuyItpModal.tsx frontend/components/domain/SellItpModal.tsx
git commit -m "refactor(frontend): migrate Buy/Sell modals to SSE order tracking"
```

---

## Task 13: Migrate ItpListing + remaining components

**Files:**
- Modify: `frontend/components/domain/ItpListing.tsx` — heaviest component (ITP discovery, holder counts)
- Modify: `frontend/components/domain/APBalanceCard.tsx` — AP collateral balance
- Modify: `frontend/hooks/useItpFees.ts` — fee registry read
- Modify: `frontend/hooks/useNonceCheck.ts` — tx nonce

**Step 1: ItpListing**

This component makes many chain calls in loops (getITP, totalSupply, balanceOf for holders). Move ITP listing data to a data-node REST endpoint:

`GET /itp-listings` — returns all ITPs with metadata, total supply, holder counts.

The data-node's ITP collector already reads `getITPState` for each ITP. Extend it to also read `totalSupply` and top holder balances, cache in DB.

**Step 2: APBalanceCard**

Read AP's collateral balance from a data-node endpoint or the system-status SSE event (vault_assets already includes vault USD totals).

**Step 3: useItpFees + useNonceCheck**

- `useItpFees`: Add fee data to the NAV poller (read `getAccumulatedFees` alongside `getITPState`)
- `useNonceCheck`: Add nonce to user balances SSE payload (already planned: `itp_nonce` field)

**Step 4: Verify build + commit**

```bash
cd frontend && npx next build
git add frontend/components/domain/ItpListing.tsx frontend/components/domain/APBalanceCard.tsx \
  frontend/hooks/useItpFees.ts frontend/hooks/useNonceCheck.ts
git commit -m "refactor(frontend): migrate ItpListing + remaining chain reads to data-node"
```

---

## Task 14: Cleanup — remove dead chain read code

**Files:**
- Modify: `frontend/hooks/useSystemStatusSSE.ts` — delete (replaced by useSSESystem)
- Modify: `frontend/lib/contracts/index-protocol-abi.ts` — remove unused ABI fragments
- Modify: `frontend/lib/contracts/morpho-abi.ts` — remove if unused
- Modify: `frontend/hooks/useFillDetails.ts` — delete if it exists (merged into useOrderStatus/SSE)
- Remove any remaining `usePublicClient` or `useReadContract` imports

**Step 1: Find all remaining wagmi chain read imports**

```bash
grep -r "useReadContract\|usePublicClient\|createPublicClient\|getLogs" frontend/hooks/ frontend/components/ --include="*.ts" --include="*.tsx" -l
```

Expected: zero matches (only the SSE hook and potentially test files).

**Step 2: Remove dead imports and files**

**Step 3: Verify build**

Run: `cd frontend && npx next build`
Expected: clean build

**Step 4: Commit**

```bash
git add -A frontend/
git commit -m "cleanup(frontend): remove all direct chain reads — SSE migration complete"
```

---

## Task 15: End-to-end verification

**Step 1: Start data-node with pollers**

```bash
cargo build --release -p data-node
./target/release/data-node serve --port 8200 ...
```

Verify in logs: "Chain pollers started", "User pollers started"

**Step 2: Test SSE stream**

```bash
curl -N "http://localhost:8200/sse/stream?topics=system,nav,oracle"
```

Verify: events arrive every 1-2s with correct data.

**Step 3: Test with user address**

```bash
curl -N "http://localhost:8200/sse/stream?topics=balances,orders&address=0xYOUR_ADDRESS"
```

Verify: user-balances and user-orders events arrive.

**Step 4: Test frontend**

Start frontend dev server, connect wallet. Verify:
- System status section shows live data
- Portfolio shows correct balances (from SSE, not chain)
- Buy/Sell flow tracks order status via SSE
- No RPC calls visible in browser Network tab (except wallet signing)

**Step 5: Grep verification**

```bash
grep -r "useReadContract\|createPublicClient\|publicClient\.readContract\|publicClient\.getLogs" \
  frontend/hooks/ frontend/components/ frontend/lib/ --include="*.ts" --include="*.tsx"
```

Expected: zero matches.

**Step 6: Final commit**

```bash
git commit --allow-empty -m "verified: SSE chain reads migration complete — 0 frontend RPC calls"
```
