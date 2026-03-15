# Stale Order Cleanup & Graceful Restart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent stale bridge orders from causing a WorkDriven feedback loop that desyncs all oracles, and ensure ALL order types resume processing after restart without manual intervention.

**Architecture:** (A) Clean up orchestrator status on ALL failure paths — L3-native AND cross-chain sell, batch AND fills. (B) Fix sell order watchdog tracking gap + terminal statuses + stale reset for ALL sell variants (including SellFilled) + remove_seen_sell_order. (C) Initialize BLSCustody nonces from on-chain state on startup. (D) Replace Settlement 5000-block event window with non-blocking ID-based startup scan injected into restructured match arms (fires even when event scan returns empty). (E) Reduce watchdog threshold. (F) Route all status writes through watchdog (SharesBridged, SellCompleted).

**Tech Stack:** Rust, ethers-rs, tokio (async)

---

## Problem Analysis

### Bug 1: WorkDriven feedback loop (crash risk)

When on-chain txs revert, the error paths in `run_l3_native_order_processing()` have **three** uncleaned failure sites:
- Line 2974: fills confirmation fails → orders stay `SubmittedOnL3` (batch succeeded but fills didn't)
- Line 3014: E021 retry fills fail → orders stay `SubmittedOnL3`
- Line 3018: non-E021 batch failure → TODO comment at 3022 but no cleanup code

**CRITICAL caveat:** The cleanup must NOT be placed unconditionally at line 3022 (end of outer `Err` arm). That position runs AFTER the E021 success path (line 3005 sets `Filled`), overwriting successful fills with `Failed`. Cleanup must be placed inside each specific failure branch.

Orders stuck in `SubmittedOnL3`/`Batched` → `has_in_flight_orders()` always true → WorkDriven every 50ms → all oracles desync.

### Bug 2: Sell orders missing from watchdog

`set_order_status()` (line 311) calls `watchdog.record_status_change()`. But `set_sell_order_status()` (line 372) does NOT. Additionally, `mark_sell_order_processed()` (line 397) and `mark_orders_shares_bridged()` (line 4921) write directly to status maps, bypassing the watchdog entirely.

The watchdog's terminal status list (line 45) only includes `Filled | ReleasedToVault | Failed` — missing `SellFilled`, `SellCompleted`, `SharesBridged`, `BridgedBackToSettlement`. And `reset_stale_order()` (line 286) only clears buy-side maps, not sell-side.

### Bug 3: BLSCustody nonce collision after restart

`custody_nonces` HashMap starts empty (line 199). `claim_custody_nonce()` returns `U256::zero()` for new addresses. After restart, nonces 0,1,2... are reused → `E025_NonceAlreadyUsed` reverts on all custody operations until nonce catches up to the on-chain high-water mark.

### Bug 4: Settlement 5000-block window

Cross-chain orders discovered via `CrossChainOrderCreated` events. On restart, cursor = 0 → `from_block = confirmed_block - 5000` (~83 min). Orders created before that window are permanently lost.

**Fix:** Settlement contract has `currentOrderId()` counter + `getCrossChainOrder(id)` / `getCrossChainSellOrder(id)` per-ID queries. Completed orders are `delete`d (user = address(0)). Vision deposits also use the shared counter but return zeroed structs from getCrossChainOrder/getCrossChainSellOrder — safely skipped.

**Key design:** The ID scan runs on startup and stores results in a shared `Arc<Mutex<Vec>>`. The main loop drains this Vec on the first settlement poll cycle, merging startup orders into the normal event-scan processing flow. This way startup orders go through the full Phase 1 pipeline (bridge + submit) alongside event-discovered orders, with no stuck `Pending` entries.

### Self-healing by order type (verified)

| Type | Discovery mechanism | After restart |
|------|-------------------|---------------|
| **L3-native (pending)** | `get_pending_orders()` scans `OrderSubmitted` events from `--from-block`, checks `getOrder(id)` for status 0 | Full rescan → all pending found |
| **L3-native (batched)** | `get_batched_orders()` checks `known_order_ids` for status 1 | Populated by above → all batched found |
| **Price cycles** | Stateless — fetches fresh prices each cycle | Immediate |
| **ITP creation** | `isPending(nonce)` on-chain, stateless | Immediate |
| **Rebalance** | `RebalanceRequested` events + `getITPState` weight-check prunes completed | Safe (contract revert on double) |
| **Cross-chain BUY** | Settlement event scan → **5000-block gap** | **BUG → fixed by Task 5** |
| **Cross-chain SELL** | Same Settlement event scan + `sell_order_mappings` (in-memory) | **BUG → fixed by Task 5** |

### Leader failover in 2-node-down scenario

- **Regular cycles** (`run_cycle`): `cycle_number % num_oracles` — rotates naturally each second
- **Bridge/L3-native**: `calculate_bridge_leader_with_failover` — rotates every 5s: `leader = (cycle + attempt) % num_oracles`
- **2 nodes down**: 1/3 signers, threshold = 2/3 → consensus fails. With Task 1 fix: sets `Failed` → no feedback loop → waits. When nodes restart: 3/3 → succeeds immediately.

### What happens when followers reject

- **Price disagreement**: Follower sends `PriceVote { approved: false }`. Leader retries up to 3x, then emergency pause.
- **Batch rejection**: Follower silently returns `Err` (no vote). Leader times out → cycle abandoned → retries next cycle.

### Contract-level dedup (double-processing safety)

| Operation | Contract guard | Behavior on duplicate |
|-----------|---------------|----------------------|
| `confirmBatch` | E021_OrderAlreadyBatched | Revert → code catches, falls through to fills |
| `confirmFills` | E024_InvalidOrderStatus | Revert → order already filled, skipped |
| `completeBuyOrder` | `delete crossChainOrders[id]` → E125 on retry | Revert → order already consumed |
| `completeSellOrder` | `delete crossChainSellOrders[id]` → E125 on retry | Revert → safe |
| Rebalance | Weight-check in `getITPState` prunes completed | Revert → safe |
| ITP creation | `isPending()` returns false after completion | Skipped |
| Bridge USDC custody | Nonce-based replay protection (`bridgeCompleted[chainId][nonce]`) | Revert → safe |

---

### Task 1: Clean up orchestrator on ALL failure paths (L3-native + cross-chain sell)

**Files:**
- Modify: `oracle/src/main.rs` (L3-native: lines 2974, 3014, 3018; Cross-chain sell: lines 2291, 2333, 2338)

**CRITICAL: Do NOT place cleanup at line 3022.** That position is unconditional inside the outer `Err(e)` arm and runs AFTER the E021 success path. If E021 fills succeed (line 3005 sets `Filled`), cleanup at 3022 would overwrite them to `Failed`.

The control flow is:
```
2979: Err(e) => {                           // batch failed
2982:   if E021 {
2999:     match fills... {
3001:       Ok => if sig > 0 { set Filled }  // SUCCESS — must NOT be overwritten
3014:       Err => warn                       // FAILURE — needs cleanup ← Step 2
3017:     }
3018:   } else {
3019:     warn("batch failed")               // FAILURE — needs cleanup ← Step 3
3020:   }
3022:   // DO NOT PUT CLEANUP HERE — would overwrite E021 success
3024: }
```

**Step 1: Add cleanup at fills failure (line 2974)**

At line 2974, fills confirmation failed AFTER batch succeeded on-chain:

```rust
// BEFORE (line 2974-2976):
                Err(e) => {
                    warn!(cycle = current_cycle, l3_cycle, error = %e, "L3-native fills confirmation failed");
                }

// AFTER:
                Err(e) => {
                    warn!(cycle = current_cycle, l3_cycle, error = %e, "L3-native fills confirmation failed");
                    // Cleanup: batch succeeded but fills failed → set Failed so WorkDriven stops
                    let orch = orchestrator.write().await;
                    for oid in &order_ids {
                        orch.set_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
                    }
                    drop(orch);
                }
```

**Step 2: Add cleanup at E021 retry fills failure (line 3014)**

```rust
// BEFORE (line 3014-3016):
                    Err(e) => {
                        warn!(cycle = current_cycle, error = %e, "L3-native fills also failed");
                    }

// AFTER:
                    Err(e) => {
                        warn!(cycle = current_cycle, error = %e, "L3-native fills also failed");
                        // Cleanup: E021 retry fills also failed → set Failed
                        let orch = orchestrator.write().await;
                        for oid in &order_ids {
                            orch.set_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
                        }
                        drop(orch);
                    }
```

**Step 3: Add cleanup inside the `else` branch (line 3018, non-E021 batch failure)**

```rust
// BEFORE (line 3018-3024):
            } else {
                warn!(cycle = current_cycle, l3_cycle, error = %e, "L3-native batch confirmation failed");
            }

            // Clean up orchestrator tracking on failure so orders can be retried next cycle
            // (don't leave stale SubmittedOnL3 entries that would be picked up by bridge pipeline)

// AFTER:
            } else {
                warn!(cycle = current_cycle, l3_cycle, error = %e, "L3-native batch confirmation failed");
                // Cleanup: non-E021 batch failure → set Failed
                let orch = orchestrator.write().await;
                for oid in &order_ids {
                    orch.set_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
                }
                drop(orch);
            }
            // NOTE: No unconditional cleanup here — E021 success path (line 3005) must not be overwritten
```

**Why `Failed` and not removing the entry:** Setting `Failed` is explicit — shows up in watchdog tracking and logs. `Failed` is NOT matched by `has_in_flight_orders()` → breaks feedback loop. The order is re-discovered next cycle by `get_pending_orders()` (on-chain status still Pending) or `get_batched_orders()` (on-chain status Batched), re-registered, and retried.

**Step 4: Add cleanup at cross-chain sell fills failure (line 2291)**

`run_cross_chain_sell_processing()` has the SAME class of bug — three failure paths with no cleanup. The control flow mirrors L3-native:

```
Phase B batch:
  Ok => {
    fills:
      Ok => set SellFilled                              // SUCCESS
      Err => if already-filled { set SellFilled }       // SUCCESS
             else { warn }                              // FAILURE line 2291 ← Step 4
  }
  Err => if E021 {
    fills:
      Ok => set SellFilled                              // SUCCESS
      Err => if already-filled { set SellFilled }       // SUCCESS
             else { warn }                              // FAILURE line 2333 ← Step 5
  } else {
    warn                                                // FAILURE line 2338 ← Step 6
  }
```

```rust
// BEFORE (line 2290-2292):
                        } else {
                            warn!(cycle = current_cycle, error = %e, "Sell fills confirmation failed");
                        }

// AFTER:
                        } else {
                            warn!(cycle = current_cycle, error = %e, "Sell fills confirmation failed");
                            // Cleanup: sell fills failed → set Failed so WorkDriven stops
                            let orch = orchestrator.write().await;
                            for oid in &submitted_sell_orders {
                                orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
                            }
                            drop(orch);
                        }
```

**Step 5: Add cleanup at cross-chain sell E021 retry fills failure (line 2333)**

```rust
// BEFORE (line 2332-2334):
                            } else {
                                warn!(cycle = current_cycle, error = %e, "Sell fills also failed after E021");
                            }

// AFTER:
                            } else {
                                warn!(cycle = current_cycle, error = %e, "Sell fills also failed after E021");
                                // Cleanup: E021 retry fills also failed → set Failed
                                let orch = orchestrator.write().await;
                                for oid in &submitted_sell_orders {
                                    orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
                                }
                                drop(orch);
                            }
```

**Step 6: Add cleanup at cross-chain sell non-E021 batch failure (line 2338)**

```rust
// BEFORE (line 2337-2339):
                } else {
                    warn!(cycle = current_cycle, error = %e, "Sell batch confirmation failed");
                }

// AFTER:
                } else {
                    warn!(cycle = current_cycle, error = %e, "Sell batch confirmation failed");
                    // Cleanup: non-E021 sell batch failure → set Failed
                    let orch = orchestrator.write().await;
                    for oid in &submitted_sell_orders {
                        orch.set_sell_order_status(*oid, oracle::BridgeOrderStatus::Failed).await;
                    }
                    drop(orch);
                }
```

**Step 7: Verify compilation**

Run: `cargo check --bin oracle`
Expected: compiles with no errors

**Step 8: Commit**

```bash
git add oracle/src/main.rs
git commit -m "fix(oracle): clean up orchestrator status on all failure paths (L3-native + sell)

Six error paths left orders stuck forever:
- L3-native: fills failure (2974), E021 retry fills (3014), non-E021 batch (3018)
- Cross-chain sell: fills failure (2291), E021 retry fills (2333), non-E021 batch (2338)
Set Failed on each specific failure branch. Same class of bug — orders stuck
in SubmittedOnL3/SellSubmittedOnL3 → has_in_flight_orders() true → WorkDriven
feedback loop."
```

---

### Task 2: Fix watchdog for sell orders + terminal statuses + stale reset

**Files:**
- Modify: `oracle/src/bridge/orchestrator.rs` (lines 372-374, 286-293, 397-408, 4921-4926)
- Modify: `oracle/src/bridge/watchdog.rs` (lines 45, 68-70)

**Step 1: Add watchdog recording to `set_sell_order_status`**

```rust
// BEFORE (line 372-374):
    pub async fn set_sell_order_status(&self, order_id: U256, status: BridgeOrderStatus) {
        self.sell_order_status.write().await.insert(order_id, status);
    }

// AFTER:
    pub async fn set_sell_order_status(&self, order_id: U256, status: BridgeOrderStatus) {
        self.watchdog.write().await.record_status_change(order_id, status.clone());
        self.sell_order_status.write().await.insert(order_id, status);
    }
```

**Step 2: Route `mark_sell_order_processed` through `set_sell_order_status`**

```rust
// BEFORE (line 397-408):
    pub async fn mark_sell_order_processed(&self, order_id: U256, tx_hash: H256) {
        self.processed_sell_orders.write().await.insert(order_id, tx_hash);
        self.sell_order_status
            .write()
            .await
            .insert(order_id, BridgeOrderStatus::SellCompleted);
        ...
    }

// AFTER:
    pub async fn mark_sell_order_processed(&self, order_id: U256, tx_hash: H256) {
        self.processed_sell_orders.write().await.insert(order_id, tx_hash);
        self.set_sell_order_status(order_id, BridgeOrderStatus::SellCompleted).await;
        ...
    }
```

**Step 3: Route `mark_orders_shares_bridged` through `set_order_status`**

```rust
// BEFORE (line 4921-4926):
    pub async fn mark_orders_shares_bridged(&self, order_ids: &[U256]) {
        let mut status = self.order_status.write().await;
        for order_id in order_ids {
            status.insert(*order_id, BridgeOrderStatus::SharesBridged);
        }
    }

// AFTER:
    pub async fn mark_orders_shares_bridged(&self, order_ids: &[U256]) {
        for order_id in order_ids {
            self.set_order_status(*order_id, BridgeOrderStatus::SharesBridged).await;
        }
    }
```

**Step 4: Add all terminal statuses to watchdog**

In `watchdog.rs` line 45, update the terminal status match:

```rust
// BEFORE:
if matches!(status, BridgeOrderStatus::Filled | BridgeOrderStatus::ReleasedToVault | BridgeOrderStatus::Failed) {

// AFTER:
if matches!(status,
    BridgeOrderStatus::Filled | BridgeOrderStatus::ReleasedToVault | BridgeOrderStatus::Failed |
    BridgeOrderStatus::SharesBridged | BridgeOrderStatus::BridgedBackToSettlement |
    BridgeOrderStatus::SellFilled | BridgeOrderStatus::SellCompleted
) {
```

Also update `cleanup_terminal` at line 68-70 with the same match:

```rust
// BEFORE:
!matches!(status, BridgeOrderStatus::Filled | BridgeOrderStatus::ReleasedToVault | BridgeOrderStatus::Failed)

// AFTER:
!matches!(status,
    BridgeOrderStatus::Filled | BridgeOrderStatus::ReleasedToVault | BridgeOrderStatus::Failed |
    BridgeOrderStatus::SharesBridged | BridgeOrderStatus::BridgedBackToSettlement |
    BridgeOrderStatus::SellFilled | BridgeOrderStatus::SellCompleted
)
```

**Step 5: Add `reset_stale_sell_order` to orchestrator**

After `reset_stale_order()` at line 293:

```rust
    /// Reset a stale SELL order for retry. Removes from all sell-side tracking maps.
    pub async fn reset_stale_sell_order(&self, order_id: &U256) {
        warn!(order_id = %order_id, "Resetting stale sell order for retry");
        self.sell_order_status.write().await.remove(order_id);
        self.processed_sell_orders.write().await.remove(order_id);
        self.sell_order_amounts.write().await.remove(order_id);
        self.sell_order_itp_ids.write().await.remove(order_id);
        self.watchdog.write().await.clear(order_id);
    }
```

**Step 6: Update stale order handler in main.rs to route sell orders**

Find the watchdog stale order handler (~line 1029-1077). Currently all stale orders go to `reset_stale_order` (buy-side only). Must route ALL `Sell*` variants (including `SellFilled` — a sell order stuck in SellFilled means completeSellOrder failed and it needs reset).

**CRITICAL: Match ALL Sell variants, not just SellPending/SellSubmittedOnL3.** A SellFilled order that times out means Phase C failed. Without this, it falls through to buy-side `reset_stale_order` which is a no-op for sell maps.

Also add `remove_seen_sell_order` after sell reset — otherwise the settlement reader's `seen_sell_orders` dedup set still contains the order and the event scan will skip it forever.

Replace the current stale order loop (lines 1047-1064) with:

```rust
for (order_id, status) in &stale_orders {
    warn!(
        order_id = %order_id,
        status = ?status,
        "Resetting stale order"
    );
    if matches!(status,
        oracle::bridge::BridgeOrderStatus::SellPending |
        oracle::bridge::BridgeOrderStatus::SellSubmittedOnL3 |
        oracle::bridge::BridgeOrderStatus::SellFilled
    ) {
        orch.reset_stale_sell_order(order_id).await;
        // Clear from seen_sell_orders dedup so event scan re-discovers it.
        // MUST be unconditional for ALL sell statuses — unlike buy orders where
        // SubmittedOnL3/Batched are re-discovered by L3-native get_pending_orders(),
        // sell orders have NO L3-native fallback discovery. The settlement event
        // scan is the ONLY way to re-discover them.
        if let Some(ref settlement_reader) = settlement_reader_for_task {
            let chain_id = settlement_reader.chain_id();
            settlement_reader.remove_seen_sell_order(chain_id, *order_id).await;
        }
    } else {
        orch.reset_stale_order(order_id).await;
        // Clear from seen_orders dedup so event scan re-discovers it
        if matches!(status,
            oracle::bridge::BridgeOrderStatus::Pending |
            oracle::bridge::BridgeOrderStatus::BridgedToL3
        ) {
            if let Some(ref settlement_reader) = settlement_reader_for_task {
                let chain_id = settlement_reader.chain_id();
                settlement_reader.remove_seen_order(chain_id, *order_id).await;
            }
        }
    }
}
```

**Step 7: Verify compilation**

Run: `cargo check --bin oracle`

**Step 8: Commit**

```bash
git add oracle/src/bridge/orchestrator.rs oracle/src/bridge/watchdog.rs oracle/src/main.rs
git commit -m "fix(oracle): complete watchdog overhaul for sell orders + terminal statuses

- set_sell_order_status() now calls watchdog.record_status_change()
- mark_sell_order_processed() and mark_orders_shares_bridged() routed through
  watchdog-aware setters instead of direct map writes
- Added SharesBridged, BridgedBackToSettlement, SellFilled, SellCompleted to
  watchdog terminal status list (prevents phantom stale warnings)
- Added reset_stale_sell_order() for sell-side map cleanup
- Stale order handler routes sell statuses to sell-specific reset"
```

---

### Task 3: Initialize BLSCustody nonces from on-chain state on startup

**Files:**
- Modify: `oracle/src/bridge/orchestrator.rs` (add init method, ~line 2098)
- Modify: `oracle/src/main.rs` (call after orchestrator creation)

**Step 1: Add `init_custody_nonce` method to BridgeOrchestrator**

After `claim_custody_nonce()` at line 2098:

```rust
    /// Initialize custody nonce from on-chain state (call on startup).
    /// Reads BLSCustody.nonce() to avoid E025_NonceAlreadyUsed reverts after restart.
    /// Only needed for L3 BLSCustody contracts (Settlement uses different nonce scheme).
    pub async fn init_custody_nonce(&self, custody_address: Address, on_chain_nonce: U256) {
        let mut nonces = self.custody_nonces.write().await;
        nonces.insert(custody_address, on_chain_nonce);
        tracing::info!(?custody_address, nonce = %on_chain_nonce, "Initialized custody nonce from on-chain state");
    }
```

**Step 2: Read on-chain nonce on startup in main.rs**

After `BridgeOrchestrator` creation and before main loop (~line 662). Only L3 BLSCustody contracts need this — Settlement uses `bridgeCompleted[chainId][nonce]` (different scheme).

**NOTE:** `bridge_config` is NOT a standalone variable in main.rs — access via `orchestrator.read().await.config()`. `consensus_chain_reader` is `Arc<dyn ChainReader>` with no `.provider()` method — create a one-off provider from `components.chain.rpc_url` (the L3 RPC URL).

```rust
// Initialize L3 custody nonces from on-chain state to avoid E025 after restart
if let Some(ref orchestrator) = bridge_orchestrator_for_task {
    let orch = orchestrator.read().await;
    let custody_addr = orch.config().oracle_custody_l3;
    drop(orch);
    if !custody_addr.is_zero() {
        // Create one-off L3 provider for nonce() call
        let l3_rpc = components.chain.rpc_url.clone();
        if let Ok(provider) = ethers::providers::Provider::<ethers::providers::Http>::try_from(&l3_rpc) {
            let nonce_selector = &ethers::utils::keccak256("nonce()")[..4];
            let tx = ethers::types::TransactionRequest::new()
                .to(custody_addr)
                .data(nonce_selector.to_vec());
            match provider.call(&tx.into(), None).await {
                Ok(data) if data.len() >= 32 => {
                    let nonce = ethers::types::U256::from_big_endian(&data);
                    orchestrator.write().await.init_custody_nonce(custody_addr, nonce).await;
                }
                Ok(_) => warn!("Unexpected nonce() response length"),
                Err(e) => warn!(error = %e, "Failed to read custody nonce on startup — will hit E025 until nonce catches up"),
            }
        }
    }
}
```

**Step 3: Verify compilation**

Run: `cargo check --bin oracle`

**Step 4: Commit**

```bash
git add oracle/src/bridge/orchestrator.rs oracle/src/main.rs
git commit -m "fix(oracle): initialize BLSCustody nonces from on-chain state on startup

After restart, custody_nonces starts empty → claim_custody_nonce returns 0 →
E025_NonceAlreadyUsed reverts. Now reads BLSCustody.nonce() on startup to
initialize the high-water mark. Only L3 custody needs this (Settlement uses
bridgeCompleted nonce scheme)."
```

---

### Task 4: Reduce watchdog threshold and verify `Failed` excluded

**Files:**
- Modify: `oracle/src/bridge/orchestrator.rs`

**Step 1: Add `SellFilled` to `has_in_flight_orders()` and verify `Failed` excluded**

Read line 380-394. Current sell-side matches: `SellPending | SellSubmittedOnL3`. Missing `SellFilled` — a sell order in `SellFilled` means Phase B succeeded but Phase C (`completeSellOrder`) hasn't happened. Without `SellFilled` triggering WorkDriven, Phase C runs at heartbeat cadence (~1s) instead of 50ms.

```rust
// BEFORE (line 390-393):
self.sell_order_status.read().await.values().any(|s| matches!(s,
    BridgeOrderStatus::SellPending |
    BridgeOrderStatus::SellSubmittedOnL3
))

// AFTER:
self.sell_order_status.read().await.values().any(|s| matches!(s,
    BridgeOrderStatus::SellPending |
    BridgeOrderStatus::SellSubmittedOnL3 |
    BridgeOrderStatus::SellFilled
))
```

Buy-side: `Pending | BridgedToL3 | SubmittedOnL3 | Batched` — no change needed. `Failed` is NOT matched → Tasks 1-2 correctly break the feedback loop.

**Step 2: Reduce watchdog threshold from 30s to 10s**

In `orchestrator.rs` line 213-214:
```rust
// BEFORE:
watchdog: RwLock::new(super::watchdog::StaleOrderWatchdog::new(
    Duration::from_secs(30),
)),

// AFTER:
watchdog: RwLock::new(super::watchdog::StaleOrderWatchdog::new(
    Duration::from_secs(10),
)),
```

**Step 3: Verify compilation**

Run: `cargo check --bin oracle`

**Step 4: Commit**

```bash
git add oracle/src/bridge/orchestrator.rs
git commit -m "fix(oracle): reduce watchdog stale threshold from 30s to 10s"
```

---

### Task 5: Replace Settlement event-scan with ID-based startup injection

**Files:**
- Modify: `common/src/types/settlement.rs` — add `CrossChainSellOrderData` struct
- Modify: `oracle/src/chain/settlement_trait.rs` — add `get_cross_chain_sell_order()` + `get_all_unfilled_orders()` to `SettlementReader` trait
- Modify: `oracle/src/chain/settlement_reader.rs` — implement `get_cross_chain_sell_order()` + `get_all_unfilled_orders()` methods
- Modify: `oracle/src/chain/data_node_settlement_reader.rs` — stub implementations for trait compliance
- Modify: `oracle/src/main.rs` — run ID scan on startup, inject into processing pipeline

**CRITICAL design decisions (from security audit):**
1. Do NOT register startup orders in orchestrator before the main loop — `Pending` orders are only processed by the event-scan pipeline, which skips orders already in the orchestrator (`get_order_status().is_some() → continue`). Registering them directly creates permanently stuck orders that also trigger WorkDriven.
2. Instead, store startup orders in `Arc<Mutex<Vec>>` and drain them inside the event-scan processing function on the first settlement poll. This merges them into the normal Phase 1 pipeline.
3. Start iteration at ID **0** not 1 — `crossChainOrderId` starts at 0 in the contract.
4. The shared counter also increments for Vision deposits — but `getCrossChainOrder`/`getCrossChainSellOrder` return zeroed structs for Vision IDs, so they're safely filtered out.
5. New methods MUST be added to the `SettlementReader` trait — `settlement_reader_for_task` is `Option<Arc<dyn SettlementReader>>`, calling concrete-only methods through a trait object won't compile.

**Step 1: Add `CrossChainSellOrderData` to common types**

In `common/src/types/settlement.rs`, after `CrossChainOrderData` (line 112):

```rust
/// Data returned from getCrossChainSellOrder() view call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossChainSellOrderData {
    /// ITP identifier (bytes32)
    pub itp_id: H256,
    /// User who placed the order
    pub user: Address,
    /// Bridged ITP token address
    pub bridged_itp_address: Address,
    /// ITP amount (18 decimals)
    pub amount: U256,
    /// Minimum sell price (18 decimals)
    pub limit_price: U256,
    /// Slippage tier
    pub slippage_tier: u8,
    /// Unix timestamp when order expires
    pub deadline: U256,
    /// Timestamp when order was created on-chain
    pub created_at: U256,
}
```

**Step 2: Add methods to `SettlementReader` trait**

In `settlement_trait.rs`, add to the `SettlementReader` trait (after `get_cross_chain_order`):

```rust
    /// Query a single cross-chain sell order by ID. Returns None if deleted (user = address(0)).
    async fn get_cross_chain_sell_order(
        &self,
        order_id: U256,
    ) -> Result<Option<CrossChainSellOrderData>, SettlementReaderError>;

    /// Scan all cross-chain orders by ID (not events). Returns unfilled buy and sell orders.
    /// Used on startup to eliminate the 5000-block event scan window.
    async fn get_all_unfilled_orders(
        &self,
    ) -> Result<(Vec<CrossChainOrder>, Vec<CrossChainSellOrderEvent>), SettlementReaderError>;
```

Add stub implementations in `data_node_settlement_reader.rs`:

```rust
    async fn get_cross_chain_sell_order(&self, _order_id: U256) -> Result<Option<CrossChainSellOrderData>, SettlementReaderError> {
        Err(SettlementReaderError::ConfigError("ID-based sell order query not supported via data node".into()))
    }

    async fn get_all_unfilled_orders(&self) -> Result<(Vec<CrossChainOrder>, Vec<CrossChainSellOrderEvent>), SettlementReaderError> {
        Err(SettlementReaderError::ConfigError("ID-based scan not supported via data node".into()))
    }
```

**Step 3: Implement `get_cross_chain_sell_order()` on SettlementChainReader**

In `settlement_reader.rs`, after `get_cross_chain_order()` (line 564):

```rust
/// Query a single cross-chain sell order by ID from SettlementBridgeCustody.
/// Returns None if the order has been deleted (user = address(0)).
pub async fn get_cross_chain_sell_order(
    &self,
    order_id: U256,
) -> Result<Option<CrossChainSellOrderData>, SettlementReaderError> {
    if self.config.settlement_custody_address.is_zero() {
        return Err(SettlementReaderError::ConfigError(
            "settlement_custody_address not configured".to_string(),
        ));
    }

    // getCrossChainSellOrder(uint256) selector
    let selector = &ethers::utils::keccak256("getCrossChainSellOrder(uint256)")[..4];
    let mut call_data = selector.to_vec();
    let mut order_id_bytes = [0u8; 32];
    order_id.to_big_endian(&mut order_id_bytes);
    call_data.extend_from_slice(&order_id_bytes);

    let tx = TransactionRequest::new()
        .to(self.config.settlement_custody_address)
        .data(call_data);

    let result = self.provider.call(&tx.into(), None).await.map_err(|e| {
        SettlementReaderError::ProviderError(format!("Failed to call getCrossChainSellOrder: {}", e))
    })?;

    // ABI: itpId(32) + user(32) + bridgedItpAddress(32) + amount(32) + limitPrice(32) + slippageTier(32) + deadline(32) + createdAt(32) = 256 bytes
    if result.len() < 256 {
        return Ok(None);
    }
    let user = Address::from_slice(&result[44..64]);
    if user.is_zero() {
        return Ok(None); // Deleted order
    }

    Ok(Some(CrossChainSellOrderData {
        itp_id: H256::from_slice(&result[0..32]),
        user,
        bridged_itp_address: Address::from_slice(&result[76..96]),
        amount: U256::from_big_endian(&result[96..128]),
        limit_price: U256::from_big_endian(&result[128..160]),
        slippage_tier: result[191] as u8,
        deadline: U256::from_big_endian(&result[192..224]),
        created_at: U256::from_big_endian(&result[224..256]),
    }))
}
```

**Step 4: Implement `get_all_unfilled_orders()` on SettlementChainReader**

```rust
/// Scan ALL cross-chain orders by ID (not events). Returns unfilled buy and sell orders.
/// Used on startup to eliminate the 5000-block event scan window.
/// Vision deposits share the same ID counter but return zeroed structs from
/// getCrossChainOrder/getCrossChainSellOrder — safely skipped.
pub async fn get_all_unfilled_orders(&self) -> Result<(Vec<CrossChainOrder>, Vec<CrossChainSellOrderEvent>), SettlementReaderError> {
    if self.config.settlement_custody_address.is_zero() {
        return Err(SettlementReaderError::ConfigError(
            "settlement_custody_address not configured".to_string(),
        ));
    }

    // 1. Call currentOrderId() on SettlementBridgeCustody
    let selector = &ethers::utils::keccak256("currentOrderId()")[..4];
    let tx = TransactionRequest::new()
        .to(self.config.settlement_custody_address)
        .data(selector.to_vec());

    let next_id_data = self.provider.call(&tx.into(), None).await.map_err(|e| {
        SettlementReaderError::ProviderError(format!("currentOrderId: {}", e))
    })?;
    let next_id = U256::from_big_endian(&next_id_data);

    // Safety: cap at 100k to avoid unbounded RPC calls on corrupted state
    let max_id = std::cmp::min(next_id.low_u64(), 100_000);

    let mut buy_orders = Vec::new();
    let mut sell_orders = Vec::new();

    // 2. Iterate 0..next_id (first order is ID 0), query each
    for id in 0..max_id {
        let order_id = U256::from(id);

        // Check buy order: getCrossChainOrder(id)
        match self.get_cross_chain_order(order_id).await {
            Ok(Some(data)) => {
                buy_orders.push(CrossChainOrder {
                    order_id,
                    itp_id: data.itp_id,
                    user: data.user,
                    amount: data.amount,
                    limit_price: data.limit_price,
                    slippage_tier: data.slippage_tier,
                    deadline: data.deadline,
                    created_at: data.created_at,
                    chain_id: self.config.settlement_chain_id,
                    block_number: 0, // Not from event — unknown
                    tx_hash: H256::zero(),
                });
                continue; // Same ID can't be both buy and sell
            }
            Ok(None) => {} // Deleted, Vision deposit, or doesn't exist as buy
            Err(e) => {
                tracing::warn!(order_id = id, error = %e, "Failed to query buy order in ID scan");
            }
        }

        // Check sell order: getCrossChainSellOrder(id)
        match self.get_cross_chain_sell_order(order_id).await {
            Ok(Some(data)) => {
                sell_orders.push(CrossChainSellOrderEvent {
                    order_id,
                    itp_id: data.itp_id,
                    user: data.user,
                    bridged_itp_address: data.bridged_itp_address,
                    amount: data.amount,
                    block_number: 0,
                    tx_hash: H256::zero(),
                });
            }
            Ok(None) => {} // Deleted, Vision deposit, or doesn't exist as sell
            Err(e) => {
                tracing::warn!(order_id = id, error = %e, "Failed to query sell order in ID scan");
            }
        }
    }

    tracing::info!(buys = buy_orders.len(), sells = sell_orders.len(), total_scanned = max_id,
        "Settlement ID scan: found unfilled orders");
    Ok((buy_orders, sell_orders))
}
```

**Step 5: Spawn non-blocking ID scan before main loop**

**CRITICAL:** The ID scan must NOT block startup. If `get_all_unfilled_orders()` runs synchronously before the main loop (`.await`), the node is absent from consensus during the scan. With 100+ orders and per-ID RPC calls, this could take seconds — causing missed consensus rounds and leadership gaps during rolling restarts.

Instead, spawn the scan as a background task. The `Arc<Mutex<Vec>>` pattern already supports this — the main loop starts immediately and drains when the scan completes.

```rust
// Startup: scan ALL Settlement orders by ID (non-blocking background task)
let startup_buy_orders: Arc<tokio::sync::Mutex<Vec<CrossChainOrder>>> =
    Arc::new(tokio::sync::Mutex::new(Vec::new()));
let startup_sell_orders: Arc<tokio::sync::Mutex<Vec<CrossChainSellOrderEvent>>> =
    Arc::new(tokio::sync::Mutex::new(Vec::new()));

// Spawn as background task so main loop starts immediately
if let Some(ref settlement_reader) = settlement_reader_for_task {
    let sr = settlement_reader.clone();
    let buy_arc = startup_buy_orders.clone();
    let sell_arc = startup_sell_orders.clone();
    tokio::spawn(async move {
        match sr.get_all_unfilled_orders().await {
            Ok((buys, sells)) => {
                if !buys.is_empty() || !sells.is_empty() {
                    info!(buys = buys.len(), sells = sells.len(),
                        "Startup ID scan complete: found unfilled Settlement orders");
                    *buy_arc.lock().await = buys;
                    *sell_arc.lock().await = sells;
                } else {
                    info!("Startup ID scan complete: no unfilled orders found");
                }
            }
            Err(e) => warn!(error = %e, "Startup Settlement ID scan failed, falling back to event scan"),
        }
    });
}
// Main loop starts immediately — doesn't wait for scan to complete
```
```

**Step 6: Restructure match arms + inject startup orders**

**CRITICAL BUG IN PREVIOUS PLAN**: The injection was placed INSIDE `Ok(orders) if !orders.is_empty() =>` (line 1538). When the event scan returns empty (the exact scenario where startup orders matter — old orders outside the 5000-block window), execution falls to `Ok(_) => { debug!(...) }` and the injection never fires.

**Fix**: Remove the `if !orders.is_empty()` guard from the match arm. Change `Ok(orders) if !orders.is_empty() =>` to `Ok(orders) =>`. This way the arm always executes, the filtering logic runs (producing empty `new_orders` if no events), and then startup injection can add to `new_orders`.

**For buy orders** — restructure `run_cross_chain_processing()` (line 1537-1565):

```rust
// BEFORE (line 1537-1565):
    match settlement_reader.get_confirmed_cross_chain_orders(from_block, confirmed_block).await {
        Ok(orders) if !orders.is_empty() => {
            // ... filtering into new_orders ...
        }
        Ok(_) => { debug!(cycle = current_cycle, "No new cross-chain orders"); }
        Err(e) => { ... }
    }

// AFTER:
    match settlement_reader.get_confirmed_cross_chain_orders(from_block, confirmed_block).await {
        Ok(orders) => {
            let now_secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            // Filter event-discovered orders (same as before)
            let mut new_orders = Vec::new();
            {
                let orch = orchestrator.read().await;
                for order in orders {
                    if orch.get_order_status(&order.order_id).await.is_some() {
                        continue;
                    }
                    let deadline_secs = order.deadline.as_u64();
                    if deadline_secs > 0 && deadline_secs < now_secs {
                        info!(order_id = %order.order_id, deadline = deadline_secs, now = now_secs, "Skipping expired cross-chain order");
                        continue;
                    }
                    new_orders.push(order);
                }
            }

            // Merge startup-discovered orders (one-time drain from background scan)
            {
                let mut startup = startup_buy_orders.lock().await;
                if !startup.is_empty() {
                    let extra_orders = std::mem::take(&mut *startup);
                    info!(count = extra_orders.len(), "Injecting startup-discovered buy orders into pipeline");
                    let orch = orchestrator.read().await;
                    for order in extra_orders {
                        if orch.get_order_status(&order.order_id).await.is_some() {
                            continue;
                        }
                        if order.deadline.as_u64() > 0 && order.deadline.as_u64() < now_secs {
                            continue;
                        }
                        new_orders.push(order);
                    }
                }
            }

            if new_orders.is_empty() {
                debug!(cycle = current_cycle, "No new cross-chain orders");
            } else {
                info!(cycle = current_cycle, order_count = new_orders.len(), "Found cross-chain orders");
                // ... rest of processing (set initial status, process sequentially) ...
            }
        }
        Err(e) => { ... }
    }
```

**For sell orders** — same restructure in `run_cross_chain_sell_processing()` (line 2090-2167):

```rust
// BEFORE (line 2090):
    match settlement_reader.get_confirmed_cross_chain_sell_orders(from_block, confirmed_block).await {
        Ok(sell_orders) if !sell_orders.is_empty() => { ... }
        Ok(_) => { debug!(...); }
        Err(e) => { ... }
    }

// AFTER:
    match settlement_reader.get_confirmed_cross_chain_sell_orders(from_block, confirmed_block).await {
        Ok(sell_orders) => {
            // Filter event-discovered sell orders
            let mut new_sell_orders = Vec::new();
            {
                let orch = orchestrator.read().await;
                for order in sell_orders {
                    if orch.get_sell_order_status(&order.order_id).await.is_none() {
                        new_sell_orders.push(order);
                    }
                }
            }

            // Merge startup-discovered sell orders (one-time drain)
            {
                let mut startup = startup_sell_orders.lock().await;
                if !startup.is_empty() {
                    let extra_orders = std::mem::take(&mut *startup);
                    info!(count = extra_orders.len(), "Injecting startup-discovered sell orders into pipeline");
                    let orch = orchestrator.read().await;
                    for order in extra_orders {
                        if orch.get_sell_order_status(&order.order_id).await.is_some() {
                            continue;
                        }
                        new_sell_orders.push(order);
                    }
                }
            }

            if new_sell_orders.is_empty() {
                debug!(cycle = current_cycle, "No new cross-chain sell orders");
            } else {
                info!(cycle = current_cycle, order_count = new_sell_orders.len(), "Found cross-chain sell orders");

                // Set initial status for all sell orders (same as before)
                {
                    let orch_write = orchestrator.write().await;
                    for sell_order in &new_sell_orders {
                        orch_write.set_sell_order_status(sell_order.order_id, oracle::BridgeOrderStatus::SellPending).await;
                        orch_write.set_sell_order_amount(sell_order.order_id, sell_order.amount).await; // CRITICAL: don't omit
                        orch_write.set_sell_order_itp_id(sell_order.order_id, sell_order.itp_id).await;
                    }
                }

                // ... rest of sell processing ...
            }
        }
        Err(e) => { ... }
    }
```

**Key difference from buy injection**: Sell orders set initial status (`SellPending`, `sell_order_amount`, `sell_order_itp_id`) inside the `!new_sell_orders.is_empty()` block, which covers BOTH event-discovered and startup-injected orders uniformly.

**Step 7: Pass `startup_buy_orders`/`startup_sell_orders` Arcs to processing functions**

Add `startup_buy_orders: Arc<Mutex<Vec<CrossChainOrder>>>` and `startup_sell_orders: Arc<Mutex<Vec<CrossChainSellOrderEvent>>>` parameters to `run_cross_chain_processing()` and `run_cross_chain_sell_processing()` respectively. Thread them from the main loop spawn sites.

**Step 8: Deduplicate `new_orders` after merging startup orders**

**CRITICAL:** If the background ID scan returns an order that's ALSO in the 5000-block event window, both the event-filter loop and the startup drain push it to `new_orders` before any status is set. The order appears twice → processed twice → second attempt reverts on-chain but could overwrite the first attempt's status with `Failed`.

After the startup drain block, before setting initial statuses, deduplicate by `order_id`:

```rust
// Deduplicate by order_id (event scan + startup injection may overlap)
new_orders.sort_by_key(|o| o.order_id);
new_orders.dedup_by_key(|o| o.order_id);
```

Apply the same dedup for sell orders:
```rust
new_sell_orders.sort_by_key(|o| o.order_id);
new_sell_orders.dedup_by_key(|o| o.order_id);
```

**Step 9: Verify compilation**

Run: `cargo check --bin oracle`

**Step 10: Commit**

```bash
git add common/src/types/settlement.rs oracle/src/chain/settlement_reader.rs oracle/src/main.rs
git commit -m "feat(oracle): ID-based Settlement order scan on startup (replaces block window)

On restart, the event-scan cursor resets → only covers last 5000 blocks (~83 min).
Orders older than that are permanently lost. New approach: iterate all order IDs
via currentOrderId() + getCrossChainOrder/getCrossChainSellOrder (starting at
ID 0, not 1). Store unfilled orders in shared Vecs, inject into event-scan
processing pipeline on first settlement poll. Orders go through full Phase 1
(bridge + submit) like normal event-discovered orders.

Vision deposits share the ID counter but return zeroed structs — safely skipped.
Capped at 100k IDs to prevent unbounded RPC on corrupted state."
```

---

### Task 6: Build, deploy, and verify on VPS

**Step 1: Push to remote**

```bash
git push mono main
```

**Step 2: SSH to VPS and pull + build**

```bash
ssh index-maker/prod/be "cd /home/max/index && git pull && export PATH=\$HOME/.cargo/bin:\$PATH && cargo build --release -p oracle 2>&1 | tail -5"
```

**Step 3: Restart oracles**

```bash
ssh index-maker/prod/be "cd /home/max/index && ./restart-oracles.sh"
```

**Step 4: Verify no WorkDriven feedback loop**

```bash
ssh index-maker/prod/be "tail -100 /home/max/index/logs/oracle-1.log | grep -E 'batch|fill|stale|Failed|WorkDriven|seed|custody nonce|Injecting startup'"
```

Verify:
- No "Stale order watchdog" warnings (unless genuine stale orders exist)
- No rapid WorkDriven cycling after order completes or fails
- Orders transition to `Filled`/`SellFilled` or `Failed` (never stuck in `SubmittedOnL3`)
- "Initialized custody nonce from on-chain state" appears on startup
- "Settlement ID scan: found unfilled orders" if any exist

**Step 5: Verify startup seeding**

```bash
ssh index-maker/prod/be "cd /home/max/index && ./restart-oracles.sh && sleep 5 && head -50 logs/oracle-1.log | grep -i 'scan\|unfilled\|custody nonce\|Injecting'"
```

**Step 6: Verify restart picks up pending orders**

With orders pending on-chain, restart oracles and verify they're processed on the next cycle.

---

## Backlog (future tasks, not in this PR)

| Item | Severity | Description |
|------|----------|-------------|
| `refundExpiredBuyOrder` | HIGH | SettlementBridgeCustody has `refundSellOrder` but NO `refundExpiredBuyOrder`. Expired buy orders with locked USDC cannot be refunded. Needs contract change. |
| `emitAssetTrades` dedup | LOW | `Investment.sol` has no on-chain dedup for `emitAssetTrades()`. Double-call for same cycle emits duplicate events. Add `assetTradesEmitted[cycleNumber]` flag. |
| `known_order_ids` compaction | MEDIUM | `Vec<U256>` in `reader.rs` only grows (line 123). After thousands of orders, `get_pending_orders()` and `get_batched_orders()` iterate ALL IDs doing RPC calls. Move settled IDs to a `HashSet` and skip them. |
| Graceful shutdown | LOW | `restart-oracles.sh` sends SIGKILL after only 2s (line 60). Increase to 10-15s to allow graceful shutdown and in-flight tx completion. |
| Vision 1000-block window | MEDIUM | Vision deposit watcher has same block-window issue as Settlement. Apply same ID-based scan pattern. |
| Cross-chain buy post-processing cleanup | LOW | `run_cross_chain_buy_post_processing` has failure paths without `Failed` cleanup. Timer-based retry mitigates. Sell-side equivalent fixed in Task 1. Buy post-processing is already a recovery path — less critical. |

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `oracle/src/main.rs` | Task 1: set `Failed` on 3 failure branches. Task 2: route stale sell orders. Task 3: init custody nonces. Task 5: startup ID scan + injection |
| `oracle/src/bridge/orchestrator.rs` | Task 2: sell watchdog + `reset_stale_sell_order` + route direct writes through watchdog. Task 3: `init_custody_nonce()`. Task 4: watchdog threshold 30s→10s |
| `oracle/src/bridge/watchdog.rs` | Task 2: add all terminal statuses to skip list + cleanup |
| `oracle/src/chain/settlement_trait.rs` | Task 5: add `get_cross_chain_sell_order()` + `get_all_unfilled_orders()` to trait |
| `oracle/src/chain/settlement_reader.rs` | Task 5: implement `get_cross_chain_sell_order()` + `get_all_unfilled_orders()` |
| `oracle/src/chain/data_node_settlement_reader.rs` | Task 5: stub implementations for trait compliance |
| `common/src/types/settlement.rs` | Task 5: `CrossChainSellOrderData` struct |

## Self-Healing Matrix (complete)

| Scenario | Order type | How it recovers |
|----------|-----------|-----------------|
| Batch fails, order still Pending | L3-native | Set `Failed` (Task 1 Step 3) → `get_pending_orders()` re-discovers next cycle |
| Fills fail after successful batch | L3-native | Set `Failed` (Task 1 Step 1) → `get_batched_orders()` picks up at line 3031 |
| E021 retry fills also fail | L3-native | Set `Failed` (Task 1 Step 2) → same recovery as above |
| E021 retry fills SUCCEED | L3-native | Set `Filled` at line 3005 → no cleanup runs (cleanup is in separate branches) |
| 2 nodes down, restart | L3-native | Full rescan from `--from-block` |
| Cross-chain order, node restarts | Cross-chain BUY | **Task 5**: ID scan injects into event pipeline → full Phase 1 processing |
| Cross-chain sell, node restarts | Cross-chain SELL | **Task 5**: ID scan injects into sell pipeline (with sell_order_amount) |
| Cross-chain fully completed | Cross-chain | `getCrossChainOrder` returns user=0 → skipped by ID scan |
| Vision deposit in ID range | Vision | `getCrossChainOrder`/`getCrossChainSellOrder` return zeroed → skipped |
| Sell batch/fills failure | Cross-chain SELL | **Task 1** Steps 4-6: set `Failed` → watchdog tracks → retried |
| Sell order stuck (any Sell* status) | Cross-chain SELL | **Task 2**: watchdog tracks all sell variants (incl. SellFilled), routes to `reset_stale_sell_order` + `remove_seen_sell_order` |
| SharesBridged order | Cross-chain BUY | **Task 2**: terminal in watchdog → no phantom stale warnings |
| Event scan returns empty on startup | Cross-chain BUY/SELL | **Task 5**: match arm restructured (no `!is_empty()` guard) → injection always fires |
| ID scan slow (100+ orders) | Cross-chain BUY/SELL | **Task 5**: scan spawned as background task → main loop starts immediately, consensus unaffected |
| Node alone, consensus fails | Any | Set `Failed` → no feedback loop → waits for quorum |
| Bridge USDC already sent, restart | Cross-chain BUY | `bridgeCompleted[chainId][nonce]` prevents double-bridge |
| BLSCustody after restart | Any custody op | **Task 3**: nonce initialized from on-chain `nonce()` |

## Expected Impact

| Before | After |
|--------|-------|
| Failed fills → stuck in SubmittedOnL3 forever | Set `Failed` → retried next cycle |
| Failed batch → stuck (TODO comment only) | Set `Failed` → retried next cycle |
| E021 success → overwritten to Failed (plan bug) | Cleanup in separate branches → E021 success preserved |
| Sell orders invisible to watchdog | Watchdog tracks + resets sell orders |
| SharesBridged/SellCompleted → phantom stale warnings | Terminal in watchdog → no false positives |
| Custody nonce starts at 0 → E025 reverts | Nonce initialized from on-chain state |
| `has_in_flight_orders()` true forever → WorkDriven spam | `has_in_flight_orders()` false → normal heartbeat |
| Settlement 5000-block window → old orders lost | ID-based scan → all unfilled orders injected into pipeline |
| Startup orders stuck in Pending (plan bug) | Injected into event-scan flow → normal Phase 1 processing |
| Order ID 0 skipped (plan bug) | Iteration starts at 0 |
| Startup injection never fires (plan bug) | Match arm restructured — no `!is_empty()` guard, injection always runs |
| ID scan blocks startup (plan bug) | Spawned as background task, main loop starts immediately |
| Sell stale handler misses SellFilled (plan bug) | All `Sell*` variants routed to `reset_stale_sell_order` |
| Sell stale reset → event scan skips (plan bug) | `remove_seen_sell_order` clears dedup after reset |
| Sell batch/fills failure → stuck forever | Set `Failed` on all 3 sell failure branches (same as L3-native) |
| `get_all_unfilled_orders()` won't compile (plan bug) | Methods added to `SettlementReader` trait + stub in data_node reader |
| Task 3 wrong variables (plan bug) | Uses `orchestrator.read().await.config()` + one-off L3 provider |
| Sell stale reset → event scan still blocks (plan bug) | `remove_seen_sell_order` unconditional for ALL Sell* statuses |
| Event+startup duplicate orders (plan bug) | `new_orders` deduped by order_id after merge |
| SellFilled → Phase C on heartbeat not WorkDriven (plan bug) | `SellFilled` added to `has_in_flight_orders()` |
| Watchdog safety net: 30s | Watchdog safety net: 10s |
