# Issuer Crate Deduplication Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate ~800-1,200 LOC of verified copy-paste duplication in the issuer crate across 3 areas: SignatureCollector trios (orchestrator.rs), consensus signature collection loops (protocol.rs), and simple calldata builders (types.rs).

**Architecture:** Extract a generic `SignatureCollectionManager<K>` that replaces 16 hand-written trios with one generic impl. Extract a `collect_signatures_generic()` helper in protocol.rs for the polling loop. Extract a `build_simple_calldata()` helper for the AbiEncoder-based calldata pattern.

**Tech Stack:** Rust, ethers, tokio, BLS signatures, AbiEncoder (crate-local in `abi.rs`)

**Non-goals:** We are NOT abstracting the full consensus flow into a generic trait. Verifiers confirmed 60-70% of each flow is flow-specific logic. We only target the mechanical boilerplate.

---

## Task 1: Generic SignatureCollectionManager — Core Struct

This is the biggest win (~400-600 LOC). Currently 16 trios of `start_*_collection` / `add_*_signature` / `check_*_threshold` in `bridge/orchestrator.rs` repeat the same logic with different key types (`U256`, `u64`, `H256`) and different HashMap field names.

**Files:**
- Create: `issuer/src/bridge/signature_manager.rs`
- Modify: `issuer/src/bridge/mod.rs` (add module)

**Step 1: Create the generic SignatureCollectionManager**

All 16 trios share this exact logic:
- `start`: create `SignatureCollector`, add leader sig, insert into map
- `add`: get mut collector, add sig, if threshold → aggregate + return result
- `check`: get collector, check threshold, aggregate if met

The key types are `U256` (order IDs), `u64` (cycle numbers), or `H256` (ITP IDs). All results are `SignedConsensusResult` (except `SubmitOrderResult` which extends it — handle separately).

```rust
// issuer/src/bridge/signature_manager.rs

use std::collections::HashMap;
use std::hash::Hash;
use std::fmt::Debug;

use ethers::types::U256;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use common::bls::Bn254BLSSigner;
use common::traits::BLSSigner;
use common::types::BLSSignature;

use super::types::{SignatureCollector, SignedConsensusResult};
use super::BridgeError;

/// Generic signature collection manager that replaces 16 hand-written trios.
///
/// Type parameter `K` is the collection key: `U256` for order-keyed flows,
/// `u64` for cycle-keyed flows, `H256` for ITP-keyed flows.
pub struct SignatureCollectionManager<K: Eq + Hash + Clone + Debug> {
    collectors: RwLock<HashMap<K, SignatureCollector>>,
    label: &'static str,
}

impl<K: Eq + Hash + Clone + Debug + Send + Sync> SignatureCollectionManager<K> {
    pub fn new(label: &'static str) -> Self {
        Self {
            collectors: RwLock::new(HashMap::new()),
            label,
        }
    }

    /// Start collecting signatures for a new consensus round.
    /// Adds the leader's own signature as the first entry.
    pub async fn start_collection(
        &self,
        key: K,
        node_index: u8,
        leader_signature: BLSSignature,
    ) {
        let mut collectors = self.collectors.write().await;
        // Use U256::zero() as dummy order_id — SignatureCollector only uses it for logging
        let mut collector = SignatureCollector::new(U256::zero());
        collector.add_signature(node_index, leader_signature);
        collectors.insert(key.clone(), collector);
        debug!(label = self.label, key = ?key, "Started signature collection");
    }

    /// Add a follower's signature. Returns `Some(result)` if threshold is now met.
    pub async fn add_follower_signature(
        &self,
        key: &K,
        signer_index: u8,
        signature: BLSSignature,
        min_signatures: usize,
        bls_signer: &Bn254BLSSigner,
    ) -> Result<Option<SignedConsensusResult>, BridgeError> {
        let mut collectors = self.collectors.write().await;
        let collector = collectors.get_mut(key).ok_or_else(|| {
            BridgeError::SignatureCollectionNotFound {
                reason: format!("{}: no active collection for key {:?}", self.label, key),
            }
        })?;

        if !collector.add_signature(signer_index, signature) {
            debug!(label = self.label, key = ?key, signer_index, "Duplicate signature, ignoring");
            return Ok(None);
        }

        if collector.has_threshold(min_signatures) {
            let sigs: Vec<BLSSignature> = collector
                .signatures()
                .iter()
                .map(|(_, sig)| sig.clone())
                .collect();
            let aggregated = bls_signer.aggregate_signatures(sigs).map_err(|e| {
                BridgeError::AggregationFailed {
                    reason: format!("{}: {}", self.label, e),
                }
            })?;
            let result = SignedConsensusResult {
                aggregated_signature: aggregated,
                signer_bitmap: collector.signer_bitmap(),
                signature_count: collector.signature_count(),
            };
            info!(
                label = self.label,
                key = ?key,
                signature_count = result.signature_count,
                "Signature threshold reached"
            );
            Ok(Some(result))
        } else {
            debug!(
                label = self.label,
                key = ?key,
                signer_index,
                count = collector.signature_count(),
                "Signature added, threshold not yet reached"
            );
            Ok(None)
        }
    }

    /// Poll: check if threshold is already met (used by leader polling loop).
    pub async fn check_threshold(
        &self,
        key: &K,
        min_signatures: usize,
        bls_signer: &Bn254BLSSigner,
    ) -> Option<SignedConsensusResult> {
        let collectors = self.collectors.read().await;
        let collector = collectors.get(key)?;

        if !collector.has_threshold(min_signatures) {
            return None;
        }

        let sigs: Vec<BLSSignature> = collector
            .signatures()
            .iter()
            .map(|(_, sig)| sig.clone())
            .collect();
        let aggregated = bls_signer.aggregate_signatures(sigs).ok()?;
        Some(SignedConsensusResult {
            aggregated_signature: aggregated,
            signer_bitmap: collector.signer_bitmap(),
            signature_count: collector.signature_count(),
        })
    }

    /// Get the current signature count for diagnostics/timeout messages.
    pub async fn get_signature_count(&self, key: &K) -> Option<usize> {
        let collectors = self.collectors.read().await;
        collectors.get(key).map(|c| c.signature_count())
    }

    /// Get the notifier for a collection (for async wakeup on new signatures).
    pub async fn get_notifier(&self, key: &K) -> Option<std::sync::Arc<tokio::sync::Notify>> {
        let collectors = self.collectors.read().await;
        collectors.get(key).map(|c| c.notifier())
    }

    /// Remove a completed collection to free memory.
    pub async fn remove(&self, key: &K) {
        let mut collectors = self.collectors.write().await;
        collectors.remove(key);
    }
}
```

**Step 2: Register module**

In `issuer/src/bridge/mod.rs`, add:
```rust
pub mod signature_manager;
pub use signature_manager::SignatureCollectionManager;
```

**Step 3: Build and verify**

Run: `cargo build -p issuer 2>&1 | grep "^error" | head -5`
Expected: zero errors (new code, not wired in yet)

**Step 4: Commit**

```
feat(issuer): add generic SignatureCollectionManager
```

---

## Task 2: Wire SignatureCollectionManager into BridgeOrchestrator

Replace the 15 `RwLock<HashMap<K, SignatureCollector>>` fields in `BridgeOrchestrator` with `SignatureCollectionManager<K>` instances. Keep `SubmitOrderResult` special-cased (it has an extra `l3_order_id` field).

**Files:**
- Modify: `issuer/src/bridge/orchestrator.rs`

**Step 1: Replace HashMap fields with managers**

In the `BridgeOrchestrator` struct (lines 69-173), replace:

```rust
// OLD — 15 separate fields:
pending_signatures: RwLock<HashMap<U256, SignatureCollector>>,
batch_signatures: RwLock<HashMap<u64, SignatureCollector>>,
fills_signatures: RwLock<HashMap<u64, SignatureCollector>>,
l3_to_arb_signatures: RwLock<HashMap<u64, SignatureCollector>>,
release_signatures: RwLock<HashMap<u64, SignatureCollector>>,
rebalance_batch_signatures: RwLock<HashMap<u64, SignatureCollector>>,
update_weights_signatures: RwLock<HashMap<H256, SignatureCollector>>,
asset_trades_signatures: RwLock<HashMap<u64, SignatureCollector>>,
submit_sell_order_signatures: RwLock<HashMap<U256, SignatureCollector>>,
complete_sell_order_signatures: RwLock<HashMap<U256, SignatureCollector>>,
collateral_move_signatures: RwLock<HashMap<u64, SignatureCollector>>,
mint_shares_signatures: RwLock<HashMap<u64, SignatureCollector>>,
complete_buy_signatures: RwLock<HashMap<u64, SignatureCollector>>,
nav_signatures: RwLock<HashMap<H256, SignatureCollector>>,

// NEW — 4 typed managers (one per key type):
bridge_sigs: SignatureCollectionManager<U256>,
sell_bridge_sigs: SignatureCollectionManager<U256>,
complete_sell_sigs: SignatureCollectionManager<U256>,
batch_sigs: SignatureCollectionManager<u64>,
fills_sigs: SignatureCollectionManager<u64>,
l3_to_arb_sigs: SignatureCollectionManager<u64>,
release_sigs: SignatureCollectionManager<u64>,
rebalance_batch_sigs: SignatureCollectionManager<u64>,
asset_trades_sigs: SignatureCollectionManager<u64>,
collateral_move_sigs: SignatureCollectionManager<u64>,
mint_shares_sigs: SignatureCollectionManager<u64>,
complete_buy_sigs: SignatureCollectionManager<u64>,
update_weights_sigs: SignatureCollectionManager<H256>,
nav_sigs: SignatureCollectionManager<H256>,
```

Keep `submit_order_signatures: RwLock<HashMap<U256, SignatureCollector>>` as-is because `SubmitOrderResult` has extra fields.

**Step 2: Update constructor**

In `BridgeOrchestrator::new()`, initialize each manager with `SignatureCollectionManager::new("bridge")`, `SignatureCollectionManager::new("batch")`, etc.

**Step 3: Replace ONE trio as proof of concept — bridge**

Replace `start_signature_collection`, `add_follower_signature`, `check_threshold_reached` (lines 766-847) with delegation:

```rust
pub async fn start_signature_collection(&self, order_id: U256, leader_signature: BLSSignature) {
    self.bridge_sigs.start_collection(order_id, self.node_index, leader_signature).await;
}

pub async fn add_follower_signature(
    &self,
    order_id: U256,
    signer_index: u8,
    signature: BLSSignature,
) -> Result<Option<BridgeResult>, BridgeError> {
    self.bridge_sigs
        .add_follower_signature(&order_id, signer_index, signature, self.config.min_signatures, &self.bls_signer)
        .await
}

pub async fn check_threshold_reached(&self, order_id: &U256) -> Option<BridgeResult> {
    self.bridge_sigs
        .check_threshold(order_id, self.config.min_signatures, &self.bls_signer)
        .await
}

pub async fn get_signature_count(&self, order_id: &U256) -> Option<usize> {
    self.bridge_sigs.get_signature_count(order_id).await
}

pub async fn get_notifier(&self, order_id: &U256) -> Option<std::sync::Arc<tokio::sync::Notify>> {
    self.bridge_sigs.get_notifier(order_id).await
}
```

Each trio goes from ~80 lines to ~15 lines of delegation.

**Step 4: Build and verify**

Run: `cargo build -p issuer 2>&1 | grep "^error" | head -10`
Expected: zero errors

**Step 5: Commit**

```
refactor(issuer): wire SignatureCollectionManager for bridge trio
```

---

## Task 3: Migrate Remaining 13 Trios

Repeat the Task 2 pattern for the remaining 13 trios. Do them in batches of 3-4 to keep commits reviewable.

**Files:**
- Modify: `issuer/src/bridge/orchestrator.rs`

**Step 1: Migrate cycle-keyed trios (batch, fills, l3_to_arb, release)**

Replace each `start_*_signature_collection` / `add_*_follower_signature` / `check_*_threshold_reached` with delegation to the corresponding `SignatureCollectionManager<u64>` field.

Functions to replace:
- `start_batch_signature_collection` / `add_batch_follower_signature` / `check_batch_threshold_reached` (lines 1708-1822)
- `start_fills_signature_collection` / `add_fills_follower_signature` / `check_fills_threshold_reached` (lines 1999-2105)
- `start_l3_to_arb_signature_collection` / `add_l3_to_arb_follower_signature` / `check_l3_to_arb_threshold` (lines 2903-3016)
- `start_release_signature_collection` / `add_release_follower_signature` / `check_release_threshold` (lines 3418-3534)

**Step 2: Build and verify**

Run: `cargo build -p issuer 2>&1 | grep "^error" | head -10`
Expected: zero errors

**Step 3: Commit**

```
refactor(issuer): migrate batch/fills/l3_to_arb/release to SignatureCollectionManager
```

**Step 4: Migrate remaining cycle-keyed trios (rebalance_batch, asset_trades, collateral_move, mint_shares, complete_buy)**

Functions to replace:
- `start_rebalance_batch_signature_collection` / `add_rebalance_batch_follower_signature` / `check_rebalance_batch_threshold` (lines 4898-5078)
- `start_asset_trades_signature_collection` / `add_asset_trades_follower_signature` / `check_asset_trades_threshold` (lines 5396-5512)
- `start_collateral_move_signature_collection` / `add_collateral_move_follower_signature` / `check_collateral_move_threshold` (lines 3734-3847)
- `start_mint_shares_signature_collection` / `add_mint_shares_follower_signature` / `check_mint_shares_threshold` (lines 3932-4045)
- `start_complete_buy_signature_collection` / `add_complete_buy_follower_signature` / `check_complete_buy_threshold` (lines 4587-4699)

**Step 5: Build and verify**

**Step 6: Commit**

```
refactor(issuer): migrate remaining cycle-keyed trios to SignatureCollectionManager
```

**Step 7: Migrate H256-keyed trios (update_weights, nav) and U256-keyed (sell_bridge, complete_sell)**

Functions to replace:
- `start_update_weights_signature_collection` / `add_update_weights_follower_signature` / `check_update_weights_threshold` (around line 5078+)
- `start_nav_signature_collection` / `add_nav_follower_signature` / `check_nav_threshold` (around line 172+)
- `start_sell_bridge_signature_collection` / `add_sell_bridge_follower_signature` / `check_sell_bridge_threshold`
- `start_complete_sell_signature_collection` / `add_complete_sell_follower_signature` / `check_complete_sell_threshold`

**Step 8: Build and verify**

**Step 9: Commit**

```
refactor(issuer): migrate H256-keyed and sell trios to SignatureCollectionManager
```

---

## Task 4: Remove Dead HashMap Fields and Imports

After all trios are migrated, remove the old `RwLock<HashMap<K, SignatureCollector>>` fields that are no longer used.

**Files:**
- Modify: `issuer/src/bridge/orchestrator.rs`

**Step 1: Remove old fields from struct definition**

Delete each `RwLock<HashMap<...>>` field that has been replaced. Keep `submit_order_signatures` (special-cased).

**Step 2: Remove old field initializations from `new()`**

**Step 3: Remove unused imports**

Clean up any `use` statements for `RwLock`, `HashMap` if they're no longer needed (they probably still are for submit_order).

**Step 4: Build and verify**

Run: `cargo build -p issuer 2>&1 | grep "^error" | head -10`
Expected: zero errors

**Step 5: Verify warning count dropped**

Run: `cargo build -p issuer 2>&1 | grep -c "warning"`
Expected: fewer warnings than before

**Step 6: Commit**

```
refactor(issuer): remove dead HashMap fields replaced by SignatureCollectionManager
```

---

## Task 5: Generic Signature Collection Loop in protocol.rs

The `collect_*_signatures` functions in `consensus/protocol.rs` repeat the same polling loop 16+ times. Extract a generic helper.

**Files:**
- Modify: `issuer/src/consensus/protocol.rs`

**Step 1: Add a generic collection helper method**

The pattern across all `collect_*_signatures` functions is:

```
loop {
    acquire bridge_orchestrator lock
    call specific check_*_threshold method
    if threshold → return Ok(result)
    if timeout → return Err(SigningTimeout)
    optionally get notifier
    sleep/select 10ms or until notified
}
```

Add this method to `ConsensusProtocol`:

```rust
/// Generic signature collection loop. Polls `check_fn` until threshold is met or timeout.
async fn collect_signatures_loop<K, R>(
    &self,
    key: K,
    timeout_ms: u64,
    label: &str,
    check_fn: impl Fn(&BridgeOrchestrator, &K) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<R>> + Send + '_>>,
    count_fn: impl Fn(&BridgeOrchestrator, &K) -> std::pin::Pin<Box<dyn std::future::Future<Output = Option<usize>> + Send + '_>>,
) -> Result<R, BridgeError>
where
    K: Debug + Send + Sync,
    R: Send,
{
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);

    loop {
        let bridge_orch_guard = self.bridge_orchestrator.read().await;
        if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
            let orch = bridge_orch.read().await;
            if let Some(result) = check_fn(&orch, &key).await {
                info!(label, key = ?key, "Signature threshold reached");
                return Ok(result);
            }

            if tokio::time::Instant::now() >= deadline {
                let received = count_fn(&orch, &key).await.unwrap_or(0);
                warn!(label, key = ?key, timeout_ms, received, "Signature collection timed out");
                return Err(ConsensusError::SigningTimeout { received, timeout_ms }.into());
            }
            drop(orch);
        } else if tokio::time::Instant::now() >= deadline {
            return Err(ConsensusError::SigningTimeout { received: 0, timeout_ms }.into());
        }
        drop(bridge_orch_guard);

        sleep(std::time::Duration::from_millis(10)).await;
    }
}
```

**Important:** The exact signature may need adjustment depending on lifetime constraints with the `RwLock` guards. If closures over `&BridgeOrchestrator` don't work cleanly with async, use a simpler approach: pass the `SignatureCollectionManager` field name as a string and match on it, or just inline the manager's `check_threshold` call. Test the closure approach first; fall back to a macro if lifetimes fight you.

**Step 2: Replace ONE collection function as proof of concept**

Replace `collect_bridge_signatures` (lines 3807-3878) with a call to the generic:

```rust
async fn collect_bridge_signatures(
    &self,
    order_id: U256,
    timeout_ms: u64,
    _min_signatures: usize,
) -> Result<BridgeResult, BridgeError> {
    self.collect_signatures_loop(
        order_id,
        timeout_ms,
        "bridge",
        |orch, key| Box::pin(orch.check_threshold_reached(key)),
        |orch, key| Box::pin(orch.get_signature_count(key)),
    ).await
}
```

**Step 3: Build and verify**

Run: `cargo build -p issuer 2>&1 | grep "^error" | head -10`

If lifetime issues arise, fall back to a macro approach:

```rust
macro_rules! collect_signatures_impl {
    ($self:ident, $key:expr, $timeout_ms:expr, $label:expr, $check_method:ident, $count_method:ident) => {{
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis($timeout_ms);
        loop {
            let bridge_orch_guard = $self.bridge_orchestrator.read().await;
            if let Some(bridge_orch) = bridge_orch_guard.as_ref() {
                let orch = bridge_orch.read().await;
                if let Some(result) = orch.$check_method(&$key).await {
                    info!(label = $label, "Signature threshold reached");
                    return Ok(result);
                }
                if tokio::time::Instant::now() >= deadline {
                    let received = orch.$count_method(&$key).await.unwrap_or(0);
                    warn!(label = $label, timeout_ms = $timeout_ms, received, "Timed out");
                    return Err(ConsensusError::SigningTimeout { received, timeout_ms: $timeout_ms }.into());
                }
                drop(orch);
            } else if tokio::time::Instant::now() >= deadline {
                return Err(ConsensusError::SigningTimeout { received: 0, timeout_ms: $timeout_ms }.into());
            }
            drop(bridge_orch_guard);
            sleep(std::time::Duration::from_millis(10)).await;
        }
    }};
}
```

**Step 4: Migrate remaining collection functions**

Replace each `collect_*_signatures` with a one-liner macro call:

```rust
async fn collect_rebalance_signatures(&self, itp_id: H256, timeout_ms: u64, _min_sigs: usize) -> Result<RebalanceResult, BridgeError> {
    collect_signatures_impl!(self, itp_id, timeout_ms, "rebalance", check_rebalance_threshold, get_rebalance_signature_count)
}
```

Each function drops from ~40-70 lines to ~3 lines.

**Step 5: Build and verify**

**Step 6: Commit**

```
refactor(issuer): extract generic signature collection loop in protocol.rs
```

---

## Task 6: Simple Calldata Builder Helper

10 of the 19 `build_*_calldata` functions use the same AbiEncoder pattern. Extract a helper.

**Files:**
- Modify: `issuer/src/bridge/types.rs`

**Step 1: Add a calldata helper function**

```rust
/// Build calldata for a simple ABI-encoded function call.
/// `signature` is the Solidity function signature, e.g. "approve(address,uint256)".
/// `encode_params` builds the ABI-encoded parameter tail.
pub fn build_calldata(signature: &str, encode_params: impl FnOnce(AbiEncoder) -> AbiEncoder) -> Vec<u8> {
    let selector = &ethers::utils::keccak256(signature)[..4];
    let mut calldata = selector.to_vec();
    let tail = encode_params(AbiEncoder::new()).finish();
    calldata.extend_from_slice(&tail);
    calldata
}
```

**Step 2: Refactor ONE function as proof of concept**

Replace `build_erc20_approve_calldata` (lines 624-634):

```rust
pub fn build_erc20_approve_calldata(spender: Address, amount: U256) -> Vec<u8> {
    build_calldata("approve(address,uint256)", |enc| {
        enc.address_padded(spender).u256(amount)
    })
}
```

**Step 3: Build and verify**

Run: `cargo build -p issuer 2>&1 | grep "^error" | head -5`
Expected: zero errors

**Step 4: Migrate remaining simple calldata functions**

Apply the same pattern to all AbiEncoder-based calldata builders:
- `build_erc20_transfer_calldata`
- `build_submit_order_calldata`
- `build_submit_order_for_calldata`
- `build_complete_sell_order_calldata`
- `build_record_collateral_move_calldata`
- `build_mint_bridged_shares_calldata`
- `build_usdc_transfer_calldata`
- `build_usdc_transfer_calldata_with_amount`
- `build_custody_execute_calldata` (if it uses AbiEncoder)

Do NOT touch the complex `Function + Token + encode_input` calldata builders (`build_confirm_batch_calldata`, `build_confirm_fills_calldata`, etc.) — they use a different encoding strategy.

**Step 5: Build and verify**

**Step 6: Commit**

```
refactor(issuer): extract build_calldata helper for simple ABI-encoded calldatas
```

---

## Task 7: Final Verification

**Files:** None modified

**Step 1: Full build**

Run: `cargo build -p issuer 2>&1 | tail -5`
Expected: zero errors

**Step 2: Count warnings before/after**

The starting warning count was 29 (after dead code cleanup). Verify it hasn't increased:

Run: `cargo build -p issuer 2>&1 | grep -c "warning"`
Expected: <= 29

**Step 3: Run tests**

Run: `cargo test -p issuer 2>&1 | tail -20`
Expected: all existing tests pass

**Step 4: Verify LOC reduction**

Run: `wc -l issuer/src/bridge/orchestrator.rs`
Expected: significant reduction (was ~5,500+ lines, target ~4,500-5,000)

**Step 5: Commit**

```
refactor(issuer): issuer crate deduplication complete
```
