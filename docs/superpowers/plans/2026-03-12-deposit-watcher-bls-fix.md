# Deposit Watcher BLS Consensus Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 4 Vision deposit/refund/withdraw operations by replacing single-signer BLS with multi-oracle consensus, fixing settlement registry address, and adding balance proof aggregation for claimRewards/withdraw.

**Architecture:** Deposit watcher stops signing — it enqueues ops to a `PendingOpsQueue`. A spawned Vision ops consensus task (leader-driven, like bridge consensus) drains the queue, collects 2/3 BLS signatures via P2P, and submits on-chain. Balance proofs aggregate via a fire-and-forget P2P broadcast after tick consensus.

**Tech Stack:** Rust (tokio async), ethers-rs, BLS BN254 signatures, Solidity 0.8.x, P2P MessagePack serialization

**Spec:** `docs/superpowers/specs/2026-03-12-deposit-watcher-bls-fix-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `contracts/src/vision/Vision.sol` | Modify | Add `withdrawRequests` mapping + setter in `withdrawToSettlement()` |
| `contracts/src/custody/SettlementBridgeCustody.sol` | Modify | Add `REFUND_TIMEOUT`, `depositCompleted` mapping |
| `contracts/script/DeployVisionUpgrade.s.sol` | Create | Upgrade script for both contracts |
| `oracle/src/consensus/keys.rs` | Modify | Fix nonce monotonicity in all 4 setters |
| `oracle/src/vision/pending_ops.rs` | Create | PendingOpsQueue + VisionOp + OpResult + OpStatus |
| `oracle/src/vision/mod.rs` | Modify | Add `pub mod pending_ops;` |
| `common/src/types/p2p.rs` | Modify | Add 9 new P2P message variants (4 proposal + 4 sign + 1 balance batch) |
| `oracle/src/consensus/messages.rs` | Modify | Route new message types to handler results |
| `oracle/src/vision/deposit_watcher.rs` | Modify | Remove BLS, add queue-based submission, on-chain verification |
| `oracle/src/consensus/protocol.rs` | Modify | Add vision ops consensus handlers (leader + follower) |
| `oracle/src/vision/engine.rs` | Modify | Balance proof P2P broadcast + aggregation |
| `oracle/src/main.rs` | Modify | Wire queue, spawn vision ops task, fix settlement registry |
| `testnet.sh` | Modify | Add `--vision-settlement-rpc-url` flag |

---

## Chunk 1: Contract Prerequisites + Nonce Fix

These are the hard prerequisites. Contracts MUST deploy before the oracle fix goes live.

### Task 1: Vision.sol — Add `withdrawRequests` mapping

**Files:**
- Modify: `contracts/src/vision/Vision.sol:771-780` (withdrawToSettlement function)

- [ ] **Step 1: Add WithdrawRequest struct and mapping to Vision.sol storage**

In `Vision.sol`, add after the existing `depositProcessed` mapping (around line 60-70 in the storage section):

```solidity
/// @notice Tracks pending settlement withdrawal requests for follower verification
struct WithdrawRequest {
    address user;
    uint256 amount;
}
mapping(uint256 => WithdrawRequest) public withdrawRequests;
```

- [ ] **Step 2: Set withdrawRequest in withdrawToSettlement()**

In `withdrawToSettlement()` (line 775-779), after `uint256 wId = withdrawNonce++;` and before the emit, add:

```solidity
withdrawRequests[wId] = WithdrawRequest(msg.sender, amount);
```

The existing function body is:
```solidity
if (virtualBalance[msg.sender] < amount) revert InsufficientBalance();
uint256 wId = withdrawNonce++;
virtualBalance[msg.sender] -= amount;
totalVirtualBalance -= amount;
// ADD HERE: withdrawRequests[wId] = WithdrawRequest(msg.sender, amount);
emit WithdrawToSettlementRequested(msg.sender, amount, wId);
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && forge build --root contracts`
Expected: Successful compilation

- [ ] **Step 4: Commit**

```bash
git add contracts/src/vision/Vision.sol
git commit -m "feat(vision): add withdrawRequests mapping for follower verification"
```

---

### Task 2: SettlementBridgeCustody.sol — Add REFUND_TIMEOUT + depositCompleted

**Files:**
- Modify: `contracts/src/custody/SettlementBridgeCustody.sol`

- [ ] **Step 1: Add constants and storage**

Add near the top of the contract (storage section, around line 90-100):

```solidity
/// @notice Minimum age (seconds) before a deposit can be refunded — prevents credit+refund race
uint256 public constant REFUND_TIMEOUT = 7200; // 2 hours

/// @notice Tracks completed deposits (disambiguates from refunded — both delete deposit record)
mapping(uint256 => bool) public depositCompleted;
```

- [ ] **Step 2: Add E153 custom error to ErrorsLib.sol**

In `contracts/src/libraries/ErrorsLib.sol`, after the last error (E152, line 852), add:

```solidity
/// @notice Refund attempted before REFUND_TIMEOUT elapsed
error E153_RefundTooEarly(uint256 orderId);
```

- [ ] **Step 3: Add REFUND_TIMEOUT check to refundVisionDeposit()**

In `refundVisionDeposit()` (line 658-686), after the deposit existence check, add:

```solidity
if (block.timestamp - dep.createdAt <= REFUND_TIMEOUT) revert ErrorsLib.E153_RefundTooEarly(orderId);
```

- [ ] **Step 4: Set depositCompleted in completeVisionDeposit()**

In `completeVisionDeposit()` (line 638-655), after the deposit existence check and before `delete visionDeposits[orderId]`, add:

```solidity
depositCompleted[orderId] = true;
```

**Note on clearing withdrawRequests**: The `withdrawRequests` mapping in Vision.sol is never cleared because `completeVisionWithdraw` executes on Settlement (different chain). Withdraw IDs are monotonic and won't be reused, so unbounded growth is acceptable. For production, a periodic cleanup could be added but is out of scope.

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && forge build --root contracts`
Expected: Successful compilation

- [ ] **Step 5: Commit**

```bash
git add contracts/src/custody/SettlementBridgeCustody.sol contracts/src/libraries/ErrorsLib.sol
git commit -m "feat(custody): add REFUND_TIMEOUT and depositCompleted for consensus safety"
```

---

### Task 3: Nonce Monotonicity Guards

**Files:**
- Modify: `oracle/src/consensus/keys.rs:109-113` (inherent settlement setter), `181-184` (trait L3 setter), `191-195` (trait settlement setter)

- [ ] **Step 1: Fix inherent set_settlement_registry_nonce (line 109)**

Change from:
```rust
pub fn set_settlement_registry_nonce(&self, nonce: u64) {
    if let Ok(mut guard) = self.settlement_nonce.write() {
        *guard = nonce;
    }
}
```

To:
```rust
pub fn set_settlement_registry_nonce(&self, nonce: u64) {
    if let Ok(mut guard) = self.settlement_nonce.write() {
        if nonce > *guard {
            *guard = nonce;
        }
    }
}
```

- [ ] **Step 2: Fix trait set_registry_nonce (line 181)**

Change from:
```rust
fn set_registry_nonce(&self, nonce: u64) {
    if let Ok(mut guard) = self.nonce.write() {
        *guard = nonce;
    }
}
```

To:
```rust
fn set_registry_nonce(&self, nonce: u64) {
    if let Ok(mut guard) = self.nonce.write() {
        if nonce > *guard {
            *guard = nonce;
        }
    }
}
```

- [ ] **Step 3: Fix trait set_settlement_registry_nonce (line 191)**

Change from:
```rust
fn set_settlement_registry_nonce(&self, nonce: u64) {
    if let Ok(mut guard) = self.settlement_nonce.write() {
        *guard = nonce;
    }
}
```

To:
```rust
fn set_settlement_registry_nonce(&self, nonce: u64) {
    if let Ok(mut guard) = self.settlement_nonce.write() {
        if nonce > *guard {
            *guard = nonce;
        }
    }
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p oracle`
Expected: Successful compilation

- [ ] **Step 5: Commit**

```bash
git add oracle/src/consensus/keys.rs
git commit -m "fix(consensus): enforce nonce monotonicity in all 4 registry nonce setters"
```

---

### Task 4: testnet.sh — Add missing settlement RPC flag

**Files:**
- Modify: `testnet.sh:676-694`

- [ ] **Step 1: Add --vision-settlement-rpc-url to oracle Vision config**

In the `_oracle_command_yaml` function, inside the `if [ -n "$VISION_ADDR" ]; then` block (after the existing `--vision-settlement-bridge-custody` / `"$VISION_SETTLEMENT_CUSTODY"` lines), add:

```bash
  - "--vision-settlement-rpc-url"
  - "$SETTLEMENT_RPC_VPS"
```

- [ ] **Step 2: Commit**

```bash
git add testnet.sh
git commit -m "fix(testnet): add --vision-settlement-rpc-url to oracle config"
```

---

## Chunk 2: PendingOpsQueue + P2P Messages

### Task 5: PendingOpsQueue (new file)

**Files:**
- Create: `oracle/src/vision/pending_ops.rs`
- Modify: `oracle/src/vision/mod.rs`

- [ ] **Step 1: Create pending_ops.rs with types**

Create `oracle/src/vision/pending_ops.rs`:

```rust
//! Thread-safe queue for vision deposit/withdraw operations.
//!
//! The deposit watcher enqueues ops; the consensus task drains, drives BLS consensus,
//! and writes results. The deposit watcher polls results to advance its state machine.

use ethers::types::{Address, H256, U256};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// A vision operation to be processed via BLS consensus.
#[derive(Debug, Clone)]
pub enum VisionOp {
    CreditBalance {
        order_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
    },
    CompleteDeposit {
        order_id: u64,
        message_hash: H256,
    },
    RefundDeposit {
        order_id: u64,
        message_hash: H256,
    },
    CompleteWithdraw {
        withdraw_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
    },
}

impl VisionOp {
    /// Returns (type_tag, id) for dedup and result lookup.
    pub fn key(&self) -> (&'static str, u64) {
        match self {
            VisionOp::CreditBalance { order_id, .. } => ("credit", *order_id),
            VisionOp::CompleteDeposit { order_id, .. } => ("complete", *order_id),
            VisionOp::RefundDeposit { order_id, .. } => ("refund", *order_id),
            VisionOp::CompleteWithdraw { withdraw_id, .. } => ("withdraw", *withdraw_id),
        }
    }

    /// Returns the message hash for BLS signing.
    pub fn message_hash(&self) -> &H256 {
        match self {
            VisionOp::CreditBalance { message_hash, .. } => message_hash,
            VisionOp::CompleteDeposit { message_hash, .. } => message_hash,
            VisionOp::RefundDeposit { message_hash, .. } => message_hash,
            VisionOp::CompleteWithdraw { message_hash, .. } => message_hash,
        }
    }

    /// Returns the order/withdraw ID.
    pub fn id(&self) -> u64 {
        match self {
            VisionOp::CreditBalance { order_id, .. } => *order_id,
            VisionOp::CompleteDeposit { order_id, .. } => *order_id,
            VisionOp::RefundDeposit { order_id, .. } => *order_id,
            VisionOp::CompleteWithdraw { withdraw_id, .. } => *withdraw_id,
        }
    }

    /// Sort priority: CreditBalance first, then others.
    pub fn sort_priority(&self) -> u8 {
        match self {
            VisionOp::CreditBalance { .. } => 0,
            VisionOp::CompleteDeposit { .. } => 1,
            VisionOp::RefundDeposit { .. } => 2,
            VisionOp::CompleteWithdraw { .. } => 3,
        }
    }

    /// Returns true if this is a CreditBalance op.
    pub fn is_credit(&self) -> bool {
        matches!(self, VisionOp::CreditBalance { .. })
    }

    /// Returns true if this is a RefundDeposit op.
    pub fn is_refund(&self) -> bool {
        matches!(self, VisionOp::RefundDeposit { .. })
    }
}

/// Status of an op in the queue.
#[derive(Debug, Clone)]
enum OpStatus {
    Queued,
    InProgress { since: Instant },
}

/// Result of a processed op.
#[derive(Debug, Clone)]
pub enum OpResult {
    /// Successfully submitted on-chain.
    Success { tx_hash: H256 },
    /// Permanent failure — will not be retried (e.g., AlreadyProcessed).
    Permanent { reason: String },
    /// Transient failure — will be retried on next loop.
    Failed { error: String },
    /// Still being processed by consensus task.
    Pending,
}

/// Entry in the pending queue.
struct PendingEntry {
    op: VisionOp,
    status: OpStatus,
}

/// Result entry with creation time for TTL.
struct ResultEntry {
    result: OpResult,
    created_at: Instant,
}

/// Thread-safe queue shared between deposit watcher and consensus task.
pub struct PendingOpsQueue {
    pending: Mutex<Vec<PendingEntry>>,
    results: Mutex<HashMap<(&'static str, u64), ResultEntry>>,
}

/// TTL for results (pruned on poll).
const RESULT_TTL_SECS: u64 = 60;
/// TTL for InProgress ops (pruned back to allow re-enqueue).
const IN_PROGRESS_TTL_SECS: u64 = 600;

impl PendingOpsQueue {
    pub fn new() -> Self {
        Self {
            pending: Mutex::new(Vec::new()),
            results: Mutex::new(HashMap::new()),
        }
    }

    /// Enqueue an op. Skips if same (type, id) is already Queued, InProgress, or has a Pending result.
    pub fn enqueue(&self, op: VisionOp) {
        let key = op.key();

        // Check results first — skip if Pending
        if let Ok(results) = self.results.lock() {
            if let Some(entry) = results.get(&key) {
                if matches!(entry.result, OpResult::Pending) {
                    return;
                }
            }
        }

        let mut pending = self.pending.lock().unwrap();

        // Prune stale InProgress entries
        let now = Instant::now();
        for entry in pending.iter_mut() {
            if let OpStatus::InProgress { since } = &entry.status {
                if now.duration_since(*since).as_secs() > IN_PROGRESS_TTL_SECS {
                    entry.status = OpStatus::Queued;
                }
            }
        }

        // Dedup: skip if already present
        let dominated = pending.iter().any(|e| {
            let ek = e.op.key();
            ek.0 == key.0 && ek.1 == key.1
        });
        if dominated {
            return;
        }

        pending.push(PendingEntry {
            op,
            status: OpStatus::Queued,
        });
    }

    /// Drain up to `max` queued ops, transitioning them to InProgress.
    ///
    /// Enforces mutual exclusion: if both CreditBalance and RefundDeposit exist
    /// for the same order_id, keeps only CreditBalance (credit takes priority).
    pub fn drain_pending(&self, max: usize) -> Vec<VisionOp> {
        let mut pending = self.pending.lock().unwrap();

        // Collect indices of Queued entries
        let mut queued_indices: Vec<usize> = pending
            .iter()
            .enumerate()
            .filter(|(_, e)| matches!(e.status, OpStatus::Queued))
            .map(|(i, _)| i)
            .collect();

        // Sort by priority (CreditBalance first)
        queued_indices.sort_by_key(|&i| pending[i].op.sort_priority());

        // Mutual exclusion: track order_ids with CreditBalance
        let credit_order_ids: std::collections::HashSet<u64> = queued_indices
            .iter()
            .filter(|&&i| pending[i].op.is_credit())
            .filter_map(|&i| {
                if let VisionOp::CreditBalance { order_id, .. } = &pending[i].op {
                    Some(*order_id)
                } else {
                    None
                }
            })
            .collect();

        let now = Instant::now();
        let mut drained = Vec::new();

        for &idx in &queued_indices {
            if drained.len() >= max {
                break;
            }

            // Skip RefundDeposit if CreditBalance exists for same order_id
            if let VisionOp::RefundDeposit { order_id, .. } = &pending[idx].op {
                if credit_order_ids.contains(order_id) {
                    continue;
                }
            }

            pending[idx].status = OpStatus::InProgress { since: now };
            drained.push(pending[idx].op.clone());
        }

        drained
    }

    /// Cancel a pending op (remove from queue). Used after successful CreditBalance
    /// to cancel any queued RefundDeposit for the same order.
    pub fn cancel_pending(&self, type_tag: &str, id: u64) {
        let mut pending = self.pending.lock().unwrap();
        pending.retain(|e| {
            let k = e.op.key();
            !(k.0 == type_tag && k.1 == id)
        });
    }

    /// Write a result for a completed op. Removes from pending.
    pub fn write_result(&self, type_tag: &'static str, id: u64, result: OpResult) {
        // Remove from pending
        {
            let mut pending = self.pending.lock().unwrap();
            pending.retain(|e| {
                let k = e.op.key();
                !(k.0 == type_tag && k.1 == id)
            });
        }

        // Write result
        let mut results = self.results.lock().unwrap();
        results.insert(
            (type_tag, id),
            ResultEntry {
                result,
                created_at: Instant::now(),
            },
        );
    }

    /// Poll for a result. Prunes expired results.
    pub fn poll_result(&self, type_tag: &'static str, id: u64) -> Option<OpResult> {
        let mut results = self.results.lock().unwrap();

        // Prune expired results
        let now = Instant::now();
        results.retain(|_, entry| {
            now.duration_since(entry.created_at).as_secs() < RESULT_TTL_SECS
        });

        results.get(&(type_tag, id)).map(|e| e.result.clone())
    }

    /// Clear a consumed result.
    pub fn clear_result(&self, type_tag: &'static str, id: u64) {
        let mut results = self.results.lock().unwrap();
        results.remove(&(type_tag, id));
    }

    /// Returns true if the queue has any Queued ops.
    pub fn has_queued(&self) -> bool {
        let pending = self.pending.lock().unwrap();
        pending.iter().any(|e| matches!(e.status, OpStatus::Queued))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn addr(n: u8) -> Address {
        Address::from([n; 20])
    }

    fn hash(n: u8) -> H256 {
        H256::from([n; 32])
    }

    #[test]
    fn test_enqueue_dedup() {
        let q = PendingOpsQueue::new();
        q.enqueue(VisionOp::CreditBalance {
            order_id: 1,
            user: addr(1),
            amount: U256::from(100),
            message_hash: hash(1),
        });
        // Duplicate — should be skipped
        q.enqueue(VisionOp::CreditBalance {
            order_id: 1,
            user: addr(1),
            amount: U256::from(100),
            message_hash: hash(1),
        });

        let drained = q.drain_pending(10);
        assert_eq!(drained.len(), 1);
    }

    #[test]
    fn test_drain_bounded() {
        let q = PendingOpsQueue::new();
        for i in 0..10 {
            q.enqueue(VisionOp::CompleteWithdraw {
                withdraw_id: i,
                user: addr(1),
                amount: U256::from(100),
                message_hash: hash(i as u8),
            });
        }

        let drained = q.drain_pending(5);
        assert_eq!(drained.len(), 5);

        // First 5 are now InProgress; remaining 5 are still Queued
        let drained2 = q.drain_pending(5);
        assert_eq!(drained2.len(), 5);
    }

    #[test]
    fn test_mutual_exclusion_credit_vs_refund() {
        let q = PendingOpsQueue::new();
        q.enqueue(VisionOp::RefundDeposit {
            order_id: 1,
            message_hash: hash(1),
        });
        q.enqueue(VisionOp::CreditBalance {
            order_id: 1,
            user: addr(1),
            amount: U256::from(100),
            message_hash: hash(2),
        });

        let drained = q.drain_pending(10);
        // Only CreditBalance should be drained, RefundDeposit excluded
        assert_eq!(drained.len(), 1);
        assert!(drained[0].is_credit());
    }

    #[test]
    fn test_result_lifecycle() {
        let q = PendingOpsQueue::new();
        q.enqueue(VisionOp::CreditBalance {
            order_id: 1,
            user: addr(1),
            amount: U256::from(100),
            message_hash: hash(1),
        });

        // Drain
        let _ = q.drain_pending(1);

        // Write result
        q.write_result("credit", 1, OpResult::Success { tx_hash: hash(99) });

        // Poll
        let result = q.poll_result("credit", 1);
        assert!(matches!(result, Some(OpResult::Success { .. })));

        // Clear
        q.clear_result("credit", 1);
        assert!(q.poll_result("credit", 1).is_none());
    }

    #[test]
    fn test_cancel_pending() {
        let q = PendingOpsQueue::new();
        q.enqueue(VisionOp::RefundDeposit {
            order_id: 1,
            message_hash: hash(1),
        });

        q.cancel_pending("refund", 1);

        let drained = q.drain_pending(10);
        assert_eq!(drained.len(), 0);
    }

    #[test]
    fn test_credit_first_ordering() {
        let q = PendingOpsQueue::new();
        q.enqueue(VisionOp::CompleteDeposit {
            order_id: 2,
            message_hash: hash(2),
        });
        q.enqueue(VisionOp::CreditBalance {
            order_id: 1,
            user: addr(1),
            amount: U256::from(100),
            message_hash: hash(1),
        });

        let drained = q.drain_pending(10);
        assert_eq!(drained.len(), 2);
        assert!(drained[0].is_credit()); // CreditBalance first
    }
}
```

- [ ] **Step 2: Add module to vision/mod.rs**

In `oracle/src/vision/mod.rs`, add after the existing module declarations:

```rust
pub mod pending_ops;
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/maxguillabert/Downloads/index && cargo test -p oracle pending_ops -- --nocapture`
Expected: All 6 tests pass

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p oracle`
Expected: Successful compilation

- [ ] **Step 5: Commit**

```bash
git add oracle/src/vision/pending_ops.rs oracle/src/vision/mod.rs
git commit -m "feat(vision): add PendingOpsQueue for consensus-driven deposit operations"
```

---

### Task 6: P2P Message Types

**Files:**
- Modify: `common/src/types/p2p.rs` (P2PMessage enum)
- Modify: `oracle/src/consensus/messages.rs` (message routing)

- [ ] **Step 1: Add 9 new P2P message variants to common/src/types/p2p.rs**

Add inside the `P2PMessage` enum (after the last existing variant, before the closing `}`):

```rust
    // Vision consensus: creditBalance on L3
    VisionCreditBalanceProposal {
        leader_id: PeerId,
        order_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
        leader_signature: BLSSignature,
    },
    VisionCreditBalanceSign {
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: BLSSignature,
    },

    // Vision consensus: completeVisionDeposit on Settlement
    VisionCompleteDepositProposal {
        leader_id: PeerId,
        order_id: u64,
        message_hash: H256,
        leader_signature: BLSSignature,
    },
    VisionCompleteDepositSign {
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: BLSSignature,
    },

    // Vision consensus: refundVisionDeposit on Settlement
    VisionRefundDepositProposal {
        leader_id: PeerId,
        order_id: u64,
        message_hash: H256,
        leader_signature: BLSSignature,
    },
    VisionRefundDepositSign {
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: BLSSignature,
    },

    // Vision consensus: completeVisionWithdraw on Settlement
    VisionCompleteWithdrawProposal {
        leader_id: PeerId,
        withdraw_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
        leader_signature: BLSSignature,
    },
    VisionCompleteWithdrawSign {
        signer_id: PeerId,
        signer_index: u8,
        withdraw_id: u64,
        signature: BLSSignature,
    },

    // Vision balance proof aggregation (fire-and-forget broadcast)
    VisionBalanceProofsBatch {
        batch_id: u64,
        tick_id: u64,
        /// Per-player: (player_address, balance, bls_signature)
        proofs: Vec<(Address, U256, BLSSignature)>,
        signer_index: u8,
    },
```

**Design note**: Vision op messages intentionally omit the `cycle: u64` field used by price/batch consensus messages. Vision ops are processed by an independent spawned task, not synchronized to the main consensus cycle. The `order_id`/`withdraw_id` serves as the correlation key instead — the leader discards sign messages whose ID doesn't match the current op.

- [ ] **Step 2: Add message routing in messages.rs**

In `oracle/src/consensus/messages.rs`, inside the `handle_message()` match block, add new arms (before the catch-all or last arm):

```rust
            // Vision consensus messages
            P2PMessage::VisionCreditBalanceProposal {
                leader_id, order_id, user, amount, message_hash, leader_signature,
            } => {
                debug!(?from, ?leader_id, order_id, "Received VisionCreditBalanceProposal");
                MessageHandleResult::ProcessVisionCreditBalanceProposal {
                    from, leader_id, order_id, user, amount, message_hash, leader_signature,
                }
            }
            P2PMessage::VisionCreditBalanceSign {
                signer_id, signer_index, order_id, signature,
            } => {
                debug!(?from, ?signer_id, signer_index, order_id, "Received VisionCreditBalanceSign");
                MessageHandleResult::ProcessVisionCreditBalanceSign {
                    from, signer_id, signer_index, order_id, signature,
                }
            }

            P2PMessage::VisionCompleteDepositProposal {
                leader_id, order_id, message_hash, leader_signature,
            } => {
                debug!(?from, ?leader_id, order_id, "Received VisionCompleteDepositProposal");
                MessageHandleResult::ProcessVisionCompleteDepositProposal {
                    from, leader_id, order_id, message_hash, leader_signature,
                }
            }
            P2PMessage::VisionCompleteDepositSign {
                signer_id, signer_index, order_id, signature,
            } => {
                debug!(?from, ?signer_id, signer_index, order_id, "Received VisionCompleteDepositSign");
                MessageHandleResult::ProcessVisionCompleteDepositSign {
                    from, signer_id, signer_index, order_id, signature,
                }
            }

            P2PMessage::VisionRefundDepositProposal {
                leader_id, order_id, message_hash, leader_signature,
            } => {
                debug!(?from, ?leader_id, order_id, "Received VisionRefundDepositProposal");
                MessageHandleResult::ProcessVisionRefundDepositProposal {
                    from, leader_id, order_id, message_hash, leader_signature,
                }
            }
            P2PMessage::VisionRefundDepositSign {
                signer_id, signer_index, order_id, signature,
            } => {
                debug!(?from, ?signer_id, signer_index, order_id, "Received VisionRefundDepositSign");
                MessageHandleResult::ProcessVisionRefundDepositSign {
                    from, signer_id, signer_index, order_id, signature,
                }
            }

            P2PMessage::VisionCompleteWithdrawProposal {
                leader_id, withdraw_id, user, amount, message_hash, leader_signature,
            } => {
                debug!(?from, ?leader_id, withdraw_id, "Received VisionCompleteWithdrawProposal");
                MessageHandleResult::ProcessVisionCompleteWithdrawProposal {
                    from, leader_id, withdraw_id, user, amount, message_hash, leader_signature,
                }
            }
            P2PMessage::VisionCompleteWithdrawSign {
                signer_id, signer_index, withdraw_id, signature,
            } => {
                debug!(?from, ?signer_id, signer_index, withdraw_id, "Received VisionCompleteWithdrawSign");
                MessageHandleResult::ProcessVisionCompleteWithdrawSign {
                    from, signer_id, signer_index, withdraw_id, signature,
                }
            }

            P2PMessage::VisionBalanceProofsBatch {
                batch_id, tick_id, proofs, signer_index,
            } => {
                debug!(?from, batch_id, tick_id, proofs_count = proofs.len(), "Received VisionBalanceProofsBatch");
                MessageHandleResult::ProcessVisionBalanceProofsBatch {
                    from, batch_id, tick_id, proofs, signer_index,
                }
            }
```

- [ ] **Step 3: Add MessageHandleResult variants**

In the `MessageHandleResult` enum (in `messages.rs`), add corresponding variants:

```rust
    ProcessVisionCreditBalanceProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
    },
    ProcessVisionCreditBalanceSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: P2PBLSSignature,
    },
    ProcessVisionCompleteDepositProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: u64,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
    },
    ProcessVisionCompleteDepositSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: P2PBLSSignature,
    },
    ProcessVisionRefundDepositProposal {
        from: PeerId,
        leader_id: PeerId,
        order_id: u64,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
    },
    ProcessVisionRefundDepositSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        order_id: u64,
        signature: P2PBLSSignature,
    },
    ProcessVisionCompleteWithdrawProposal {
        from: PeerId,
        leader_id: PeerId,
        withdraw_id: u64,
        user: Address,
        amount: U256,
        message_hash: H256,
        leader_signature: P2PBLSSignature,
    },
    ProcessVisionCompleteWithdrawSign {
        from: PeerId,
        signer_id: PeerId,
        signer_index: u8,
        withdraw_id: u64,
        signature: P2PBLSSignature,
    },
    ProcessVisionBalanceProofsBatch {
        from: PeerId,
        batch_id: u64,
        tick_id: u64,
        proofs: Vec<(Address, U256, P2PBLSSignature)>,
        signer_index: u8,
    },
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p oracle -p common`
Expected: Successful compilation (may have unused variant warnings — expected until handlers are wired)

- [ ] **Step 5: Commit**

```bash
git add common/src/types/p2p.rs oracle/src/consensus/messages.rs
git commit -m "feat(consensus): add 9 P2P message types for vision consensus + balance proofs"
```

---

## Chunk 3: Deposit Watcher Refactor

### Task 7: Refactor Deposit Watcher — Remove BLS, Add Queue

**Files:**
- Modify: `oracle/src/vision/deposit_watcher.rs`

This is the largest single refactor. The deposit watcher stops signing and submitting — it enqueues ops and polls results.

- [ ] **Step 1: Update struct fields — remove BLS, add queue**

Replace the struct definition (lines 50-90). Remove these fields:
- `bls_keypair`
- `bls_signer`
- `l3_chain_writer` (keep for gas drip only — used in step 8's Success branch)
- `settlement_chain_writer`
- `node_index`
- `l3_registry_address`
- `settlement_registry_address`

Add:
```rust
/// Pending operations queue (shared with consensus task)
ops_queue: Arc<PendingOpsQueue>,
/// L3 chain ID (from config, not hardcoded)
l3_chain_id: u64,
/// Settlement chain ID (from config)
settlement_chain_id: u64,
```

Keep `l3_chain_writer` for `drip_gas_if_needed()` which sends a plain native transfer (not BLS-verified).

Update the constructor signature to match (remove BLS params, add `ops_queue: Arc<PendingOpsQueue>`, `l3_chain_id: u64`, `settlement_chain_id: u64`).

- [ ] **Step 2: Replace sign_and_submit_credit_balance() with request_credit_balance()**

Replace the method (lines 692-737) with:

```rust
/// Enqueue a CreditBalance op for BLS consensus.
fn request_credit_balance(&self, order_id: u64, user: Address, amount: U256, message_hash: H256) {
    self.ops_queue.enqueue(VisionOp::CreditBalance {
        order_id,
        user,
        amount,
        message_hash,
    });
}
```

- [ ] **Step 3: Replace sign_and_submit_complete_deposit() with request_complete_deposit()**

Replace the method (lines 739-777) with:

```rust
fn request_complete_deposit(&self, order_id: u64, message_hash: H256) {
    self.ops_queue.enqueue(VisionOp::CompleteDeposit {
        order_id,
        message_hash,
    });
}
```

- [ ] **Step 4: Replace sign_and_submit_refund_deposit() with request_refund_deposit()**

Replace the method (lines 779-817) with:

```rust
fn request_refund_deposit(&self, order_id: u64, message_hash: H256) {
    self.ops_queue.enqueue(VisionOp::RefundDeposit {
        order_id,
        message_hash,
    });
}
```

- [ ] **Step 5: Replace sign_and_submit_complete_withdraw() with request_complete_withdraw()**

Replace the method (lines 819-867) with:

```rust
fn request_complete_withdraw(&self, withdraw_id: u64, user: Address, amount: U256, message_hash: H256) {
    self.ops_queue.enqueue(VisionOp::CompleteWithdraw {
        withdraw_id,
        user,
        amount,
        message_hash,
    });
}
```

- [ ] **Step 6: Remove get_reference_nonce()**

Delete the `get_reference_nonce()` method (lines 669-691). The consensus task reads nonces, not the deposit watcher.

- [ ] **Step 7: Fix chain ID in build_credit_balance_hash()**

In `build_credit_balance_hash()` (line 486), replace the hardcoded chain ID:

```rust
// Before:
let chain_id = 111_222_333u64;
// After:
let chain_id = self.l3_chain_id;
```

Do the same for all other `build_*_hash()` calls — use `self.l3_chain_id` for L3 ops (creditBalance) and `self.settlement_chain_id` for settlement ops (completeDeposit, refundDeposit, completeWithdraw).

- [ ] **Step 8: Refactor process_pending_deposits() — queue-based state machine**

The state machine logic changes from "sign+submit then advance" to "enqueue then poll". Modify the `DepositStatus::Pending` arm (lines 435-522):

**First visit** (no result in queue): compute message_hash, call `request_credit_balance()`.

**Subsequent visits**: call `ops_queue.poll_result("credit", order_id)`:
- `Some(OpResult::Success { tx_hash })` → verify on-chain: call `is_deposit_processed_on_l3(order_id)`. If true: clear result, advance to `CreditedOnL3`, call `drip_gas_if_needed(deposit.user)`. If false: log warning, keep polling (RPC lag).
- `Some(OpResult::Permanent { reason })` → clear result, check on-chain state. If `depositProcessed == true`, advance to `CreditedOnL3`. Otherwise log and skip (already processed by another means).
- `Some(OpResult::Failed { error })` → clear result, will re-enqueue next loop.
- `Some(OpResult::Pending)` → skip, wait for consensus.
- `None` → re-enqueue (result expired or not yet written).

Modify the `DepositStatus::CreditedOnL3` arm (lines 523-576): use `request_complete_deposit()` and `poll_result("complete", order_id)`.

**CRITICAL — Cross-chain atomicity for CompleteDeposit**:
- CompleteDeposit MUST retry indefinitely on `Failed` results. Never set a max retry count. Never mark as `Permanent` unless on-chain state confirms completion (deposit record deleted on Settlement). The USDC MUST be released eventually.
- Add a `complete_deposit_first_fail: HashMap<u64, Instant>` field to track when CompleteDeposit first started failing per order_id. If consecutive failures exceed 24 hours, log a `CRITICAL` alert: `"CompleteDeposit stuck for >24h: order_id={}, amount={}"`.
- NEVER call `request_refund_deposit()` for an order where `depositProcessed == true` on L3. The `is_deposit_processed_on_l3()` check in `check_auto_refund()` already prevents this, but it must remain a hard guard.

- [ ] **Step 9: Refactor process_pending_withdrawals() — queue-based**

Same pattern: replace `sign_and_submit_complete_withdraw()` with `request_complete_withdraw()` + `poll_result("withdraw", withdraw_id)`.

- [ ] **Step 10: Refactor check_auto_refund() — queue-based**

Replace the direct signing in `check_auto_refund()` (lines 944-1044) with:
1. Keep the `is_deposit_processed_on_l3()` safety check (line 964)
2. Replace `sign_and_submit_refund_deposit()` with `request_refund_deposit()`
3. Poll results on subsequent calls

- [ ] **Step 11: Add necessary imports**

At the top of `deposit_watcher.rs`, add:

```rust
use super::pending_ops::{PendingOpsQueue, VisionOp, OpResult};
use std::sync::Arc;
```

- [ ] **Step 12: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p oracle`
Expected: Successful compilation (with possible warnings about unused imports — clean up as needed)

- [ ] **Step 13: Commit**

```bash
git add oracle/src/vision/deposit_watcher.rs
git commit -m "refactor(vision): replace single-signer BLS with queue-based consensus submission"
```

---

## Chunk 4: Vision Ops Consensus Task

### Task 8: Consensus Protocol — Vision Ops Handlers

**Files:**
- Modify: `oracle/src/consensus/protocol.rs`
- Modify: `oracle/src/consensus/handler_macros.rs` (register proposal handlers)

This is the core consensus logic — leader drives BLS signature collection, followers validate and sign.

**IMPORTANT — All 4 operation types must be implemented together.** Do NOT selectively enable operation types or put any behind feature flags. The contract changes (REFUND_TIMEOUT, withdrawRequests) are security prerequisites — the oracle code assumes they exist. All 4 go through consensus in a single code path.

**Sign message architecture**: The leader's spawned task receives sign messages via a `tokio::sync::mpsc` channel. The main message dispatch (where `MessageHandleResult` is consumed) sends sign messages through this channel. The leader task polls the channel with a deadline (sign_timeout_ms). This follows the same pattern as existing bridge consensus.

```rust
// In the spawned task:
let (sign_tx, mut sign_rx) = tokio::sync::mpsc::channel::<VisionSignMessage>(32);

// In the main message dispatch (handle_message match):
// ProcessVisionCreditBalanceSign → sign_tx.try_send(VisionSignMessage::CreditBalance { from, order_id, signature })
```

The channel sender (`sign_tx`) is stored as `Arc<Mutex<Option<mpsc::Sender<VisionSignMessage>>>>` so the message dispatch can access it. The spawned task sets it before broadcasting proposals and clears it after collecting signatures.

- [ ] **Step 1: Add VisionSignMessage enum and channel storage**

Add a new enum for sign message forwarding:

```rust
pub enum VisionSignMessage {
    CreditBalance { from: PeerId, order_id: u64, signature: Vec<u8> },
    CompleteDeposit { from: PeerId, order_id: u64, signature: Vec<u8> },
    RefundDeposit { from: PeerId, order_id: u64, signature: Vec<u8> },
    CompleteWithdraw { from: PeerId, withdraw_id: u64, signature: Vec<u8> },
}
```

Add to `ConsensusProtocol` struct:
```rust
pub vision_sign_tx: Arc<Mutex<Option<mpsc::Sender<VisionSignMessage>>>>,
```

- [ ] **Step 2: Add vision ops processing function (leader flow)**

Add a new public method to `ConsensusProtocol`:

```rust
/// Process vision deposit/withdraw ops via BLS consensus.
/// Called from a spawned task in main.rs.
pub async fn run_vision_ops(
    &self,
    ops_queue: &Arc<PendingOpsQueue>,
    l3_provider: &Provider<Http>,
    settlement_provider: &Provider<Http>,
    l3_chain_writer: &Arc<dyn ChainWriter>,
    settlement_chain_writer: &Arc<dyn ChainWriter>,
    vision_address: Address,
    custody_address: Address,
    l3_chain_id: u64,
    settlement_chain_id: u64,
) -> Result<(), ConsensusError>
```

Implementation outline:
1. `let ops = ops_queue.drain_pending(5);` — get up to 5 ops
2. If empty, return Ok
3. **Pre-flight**: check MirrorRegistry sync — `self.key_registry.settlement_registry_nonce()` vs `self.key_registry.registry_nonce()`. If mismatch, write `Failed` for all ops and return. Also check `self.key_registry.peer_count() >= 3`.
4. Sort ops: CreditBalance first (by `sort_priority()`)
5. Create `mpsc::channel(32)`, store sender in `self.vision_sign_tx`
6. For each op (sequentially):
   a. **Dedup check**: read on-chain state (e.g., `depositProcessed[orderId]`). If already done → `write_result(Permanent)`
   b. **Recompute message_hash** from op params + own config (chain_id, addresses). Compare with queued hash — reject on mismatch with `Failed("message_hash mismatch")`
   c. Create fresh `SignatureAggregator` (per-op, NOT shared)
   d. Sign message_hash with own BLS keypair
   e. Add own signature to aggregator
   f. Broadcast proposal (e.g., `VisionCreditBalanceProposal`)
   g. **Collect sign messages**: poll `sign_rx` with `tokio::time::timeout(sign_timeout_ms)`. For each received sign:
      - Derive `actual_signer_index` from `extract_oracle_id(&msg.from)` — NOT from self-reported field
      - Verify `order_id`/`withdraw_id` matches current op — discard if mismatch
      - Add to aggregator with `actual_signer_index`
      - Break when threshold reached
   h. On threshold: aggregate, read referenceNonce (L3 → `registry_nonce()`, Settlement → `settlement_registry_nonce()`), build calldata, submit tx
   i. Wait for receipt, classify revert:
      - `AlreadyProcessed` / `DepositAlreadyProcessed` → `OpResult::Permanent`
      - `E131_VisionDepositNotFound` → `OpResult::Permanent`
      - `E132_VisionWithdrawAlreadyProcessed` → `OpResult::Permanent`
      - `BelowThreshold` → `OpResult::Failed` (config issue)
      - Other → `OpResult::Failed` with decoded reason
   j. If CreditBalance success: `cancel_pending("refund", order_id)`
   k. If CreditBalance + CompleteDeposit in same batch: `tokio::time::sleep(3s)` between them for RPC propagation
7. Clear `self.vision_sign_tx` (set to None)

- [ ] **Step 3: Add follower proposal handlers (4 handlers, all custom)**

For each proposal type, add a handler method. These are custom (NOT using `bridge_proposal_handler!` or `bridge_sign_handler!` macro) because we need `extract_oracle_id(&from)` for signer_index validation.

**CRITICAL — Fail-closed behavior**: ALL `eth_call` failures during follower validation MUST result in refusing to sign (return without sending a Sign message). This includes "function not found" errors from unupgraded contracts. Never treat RPC errors as "skip the check."

**Handler 1: CreditBalance follower** (`handle_vision_credit_balance_proposal`):

```rust
pub async fn handle_vision_credit_balance_proposal(
    &self,
    from: &PeerId,
    order_id: u64,
    user: Address,
    amount: U256,
    message_hash: H256,
    leader_signature: BLSSignature,
    settlement_provider: &Provider<Http>,
    l3_provider: &Provider<Http>,
    custody_address: Address,
    vision_address: Address,
    l3_chain_id: u64,
) -> Result<(), ConsensusError> {
    // 1. Recompute message_hash from own config
    let expected_hash = build_credit_balance_hash(l3_chain_id, vision_address, user, amount, U256::from(order_id));
    if expected_hash != message_hash {
        warn!(order_id, "CreditBalance proposal hash mismatch — rejecting");
        return Ok(());
    }

    // 2. Verify leader BLS signature on message_hash
    let leader_pubkey = self.key_registry.get_key(from).ok_or_else(|| {
        warn!(order_id, "Unknown leader peer — rejecting");
        ConsensusError::UnknownPeer
    })?;
    // verify signature against leader_pubkey...

    // 3. MANDATORY: Verify deposit exists on settlement with EXACT amount + user match
    // Call SettlementBridgeCustody.visionDeposits(orderId) via eth_call on settlement_provider
    // If RPC error → return Ok(()) WITHOUT signing (fail-closed)
    // If deposit.amount != amount || deposit.user != user → reject
    // If deposit.user == address(0) → reject (deposit doesn't exist)

    // 4. MANDATORY: Verify depositProcessed[orderId] == false on L3
    // Call Vision.depositProcessed(orderId) via eth_call on l3_provider
    // If RPC error → return Ok(()) WITHOUT signing (fail-closed)
    // If true → return Ok(()) (already credited, don't double-credit)

    // 5. Sign message_hash with own BLS keypair
    let signature = self.bls_signer.sign_message_hash(&self.bls_keypair, &message_hash.0);

    // 6. Send VisionCreditBalanceSign back to leader
    let sign_msg = P2PMessage::VisionCreditBalanceSign {
        signer_id: self.peer_id,
        signer_index: self.node_index,
        order_id,
        signature: BLSSignature(signature),
    };
    self.p2p.send_to(from, sign_msg).await;
    Ok(())
}
```

**Handler 2: CompleteDeposit follower** (`handle_vision_complete_deposit_proposal`):
1. MANDATORY: Recompute `message_hash == keccak256(abi.encode(settlement_chain_id, custody_address, "completeVisionDeposit", orderId))`
2. MANDATORY: Check `depositProcessed[orderId]` on L3. **Retry with backoff**: if returns false, retry up to 3 times with 2-second intervals before rejecting. This handles L3 RPC propagation delay.
3. MANDATORY: Check `visionDeposits[orderId].user != address(0)` on Settlement — deposit record must still exist (not already completed/refunded).
4. If ALL checks pass, sign and send `VisionCompleteDepositSign`.
5. If ANY RPC call fails → return without signing (fail-closed).

**Handler 3: RefundDeposit follower** (`handle_vision_refund_deposit_proposal`):

```rust
/// Compile-time constant — MUST match on-chain REFUND_TIMEOUT in SettlementBridgeCustody
const REFUND_TIMEOUT: u64 = 7200; // 2 hours
```

1. MANDATORY: Recompute `message_hash == keccak256(abi.encode(settlement_chain_id, custody_address, "refundVisionDeposit", orderId))`
2. MANDATORY: Verify deposit exists on settlement — `visionDeposits[orderId].amount > 0`
3. MANDATORY: Verify `depositProcessed[orderId] == false` on L3 — **if true, REFUSE to sign. Refunding a credited deposit is a double-spend.**
4. MANDATORY: Verify deposit age exceeds `REFUND_TIMEOUT` — read `visionDeposits[orderId].createdAt` from settlement, check `block.timestamp - createdAt > REFUND_TIMEOUT`. Use current settlement block timestamp.
5. If ALL checks pass, sign and send `VisionRefundDepositSign`.
6. If ANY RPC call fails → return without signing (fail-closed).

**Handler 4: CompleteWithdraw follower** (`handle_vision_complete_withdraw_proposal`):
1. MANDATORY: Recompute `message_hash == keccak256(abi.encode(settlement_chain_id, custody_address, "completeVisionWithdraw", withdrawId, user, amount))`
2. MANDATORY: Verify withdrawal request exists on L3 — call `Vision.withdrawRequests(withdrawId)` and confirm `request.user == proposal.user` AND `request.amount == proposal.amount`. **Requires the Vision.sol contract upgrade from Task 1.**
3. If ALL checks pass, sign and send `VisionCompleteWithdrawSign`.
4. If ANY RPC call fails (including "function not found" from unupgraded contract) → return without signing (fail-closed).

- [ ] **Step 4: Wire sign messages to channel in main message dispatch**

In the main `handle_message()` match (wherever `MessageHandleResult` is consumed), add arms for all 9 new result types:
- **Proposal results** → call `handle_vision_*_proposal()` (async, spawned or inline)
- **Sign results** → forward to `vision_sign_tx` channel:
  ```rust
  MessageHandleResult::ProcessVisionCreditBalanceSign { from, order_id, signature, .. } => {
      if let Some(tx) = protocol.vision_sign_tx.lock().unwrap().as_ref() {
          let _ = tx.try_send(VisionSignMessage::CreditBalance { from, order_id, signature: signature.0 });
      }
  }
  ```
- **BalanceProofsBatch** → forward to engine (see Task 10)

- [ ] **Step 5: Register proposal handlers in handler_macros.rs**

In `oracle/src/consensus/handler_macros.rs`, register the 4 new proposal message types using `bridge_proposal_handler!` macro if the pattern fits, OR add routing entries manually if the macro doesn't match (since vision proposals need settlement+L3 providers for validation).

**Note**: Sign handlers are NOT registered via macro — they go through the mpsc channel (Step 4).

- [ ] **Step 6: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p oracle`
Expected: Successful compilation

- [ ] **Step 7: Commit**

```bash
git add oracle/src/consensus/protocol.rs oracle/src/consensus/handler_macros.rs
git commit -m "feat(consensus): add vision ops BLS consensus handlers (leader + follower)"
```

---

## Chunk 5: Wiring + Balance Proofs + Integration

### Task 9: Wire Vision Ops Task in main.rs

**Files:**
- Modify: `oracle/src/main.rs`

- [ ] **Step 1: Create PendingOpsQueue and pass to deposit watcher**

In the deposit watcher initialization section (lines 4650-4706):

```rust
// Create shared queue BEFORE deposit watcher
let vision_ops_queue = Arc::new(PendingOpsQueue::new());
```

Pass `vision_ops_queue.clone()` to `VisionDepositWatcher::new()` instead of BLS params. Also pass:
- `l3_chain_id`: from `config.l3_chain_id` (the L3 Orbit chain ID, 111222333)
- `settlement_chain_id`: from `config.effective_settlement_chain_id()` (Sonic chain ID, 14601)

- [ ] **Step 2: Fix settlement registry address**

Change line 4694 to use mirror registry address:

```rust
// Before: passes same dw_registry_address for both
// After:
let dw_settlement_registry: Address = mirror_registry_address
    .unwrap_or(Address::zero());
```

Pass `dw_settlement_registry` as the settlement registry param (no longer needed by deposit watcher, but needed by the consensus task for follower validation).

- [ ] **Step 3: Add vision ops task spawning in main loop**

In the settlement_poll_due section (after line 993), add:

```rust
// Vision ops consensus — spawn if queue has work and not already running
if settlement_poll_due && !vision_ops_active.load(Ordering::Acquire) {
    if vision_ops_queue_for_task.has_queued() {
        vision_ops_active.store(true, Ordering::Release);
        let flag = vision_ops_active.clone();
        let p = protocol.clone();
        let q = vision_ops_queue_for_task.clone();
        // ... clone providers, writers, addresses
        tokio::spawn(async move {
            let _guard = FlagGuard(flag);
            p.run_vision_ops(&q, &l3_prov, &settlement_prov, &l3_writer, &settlement_writer,
                vision_addr, custody_addr, l3_chain_id, settlement_chain_id).await.ok();
        });
    }
}
```

- [ ] **Step 4: Declare vision_ops_active AtomicBool**

Near the other AtomicBool declarations (around line 830-840), add:

```rust
let vision_ops_active = Arc::new(AtomicBool::new(false));
```

Clone it for the task like the other flags.

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p oracle`
Expected: Successful compilation

- [ ] **Step 6: Commit**

```bash
git add oracle/src/main.rs
git commit -m "feat(main): wire PendingOpsQueue, spawn vision ops task, fix settlement registry"
```

---

### Task 10: Balance Proof Aggregation

**Files:**
- Modify: `oracle/src/vision/engine.rs`

- [ ] **Step 1: Split generate_and_store_balance_proofs into sign + broadcast**

Rename `generate_and_store_balance_proofs()` to `sign_balance_proofs()`. Instead of storing directly to DB, return the signed proofs as a `Vec<(Address, U256, Vec<u8>)>` (player, balance, signature_bytes).

- [ ] **Step 2: Broadcast VisionBalanceProofsBatch after signing**

After `sign_balance_proofs()` returns, broadcast via P2P:

```rust
let msg = P2PMessage::VisionBalanceProofsBatch {
    batch_id,
    tick_id,
    proofs: signed_proofs.clone(),
    signer_index: config.node_index,
};
p2p.broadcast(msg).await;
```

- [ ] **Step 3: Add BalanceProofCollector struct and peer proof handler**

Add a new struct to `engine.rs` (or a separate `oracle/src/vision/balance_proof_collector.rs` if engine.rs is already large):

```rust
/// Collects BLS signatures from peers for balance proof aggregation.
struct BalanceProofCollector {
    /// Per-player signatures from all oracles: (batch_id, player) → Vec<(signer_index, signature_bytes)>
    pending_sigs: HashMap<(u64, Address), Vec<(u8, Vec<u8>)>>,
    /// When collection started for each batch (for 5s timeout)
    batch_start: HashMap<u64, Instant>,
}
```

The collector lives as a field on the engine's run loop state (or passed through the tick resolution flow). It is NOT a global — it is created fresh or cleared per tick cycle.

Add a handler function that receives `VisionBalanceProofsBatch` from peers:

```rust
pub fn handle_vision_balance_proofs_batch(
    collector: &mut BalanceProofCollector,
    batch_id: u64,
    tick_id: u64,
    proofs: Vec<(Address, U256, BLSSignature)>,
    from: &PeerId,
    bls_signer: &Bn254BLSSigner,
    key_registry: &dyn KeyRegistry,
    own_balances: &HashMap<Address, U256>, // agreed balances from tick consensus
    l3_chain_id: u64,
    vision_address: Address,
)
```

1. Derive actual `signer_index` from `extract_oracle_id(from)` — NOT from self-reported field
2. For each proof `(player, balance, sig)`:
   - Verify balance matches own agreed balance for this player (reject mismatches)
   - Recompute expected message hash: `keccak256(abi.encode(l3_chain_id, vision_address, "WITHDRAW", batch_id, player, balance))`
   - Verify BLS signature against expected hash using the peer's public key from key_registry
   - If valid: store `(signer_index, sig.0)` in `collector.pending_sigs[(batch_id, player)]`
3. If any signature fails verification, log warning and skip that individual proof (don't reject the entire batch)

- [ ] **Step 4: Add aggregation + DB storage**

The 5s timeout starts from when the local node finishes signing and broadcasting its own proofs. After the timeout (or after receiving signatures from all peers), aggregate per-player:

```rust
fn aggregate_and_store_balance_proofs(
    collector: &BalanceProofCollector,
    own_proofs: &[(Address, U256, Vec<u8>)], // from sign_balance_proofs()
    own_signer_index: u8,
    batch_id: u64,
    tick_id: u64,
    db_pool: &PgPool,
    bls_signer: &Bn254BLSSigner,
) {
    for (player, balance, own_sig) in own_proofs {
        let mut all_sigs: Vec<(u8, &[u8])> = vec![(own_signer_index, own_sig)];
        if let Some(peer_sigs) = collector.pending_sigs.get(&(batch_id, *player)) {
            for (idx, sig) in peer_sigs {
                all_sigs.push((*idx, sig));
            }
        }

        if all_sigs.len() >= 2 {
            // Aggregate BLS signatures
            let aggregated = bls_signer.aggregate_signatures(&all_sigs.iter().map(|(_, s)| s.to_vec()).collect::<Vec<_>>());
            let bitmap: U256 = all_sigs.iter().fold(U256::zero(), |acc, (idx, _)| acc | (U256::one() << *idx));
            // Upsert to vision_balance_proofs with aggregated sig + bitmap
        } else {
            // Store single-signer proof (will fail BelowThreshold on-chain, but API can still serve it)
            let bitmap = U256::one() << own_signer_index;
            // Upsert with own_sig + bitmap
        }
    }
}
```

The aggregation runs as `tokio::time::sleep(Duration::from_secs(5))` after broadcasting, then processes whatever signatures have been collected.

- [ ] **Step 5: Wire the handler in message dispatch**

In the `MessageHandleResult::ProcessVisionBalanceProofsBatch` arm, forward to the engine's balance proof handler.

- [ ] **Step 6: Verify compilation**

Run: `cd /Users/maxguillabert/Downloads/index && cargo check -p oracle`
Expected: Successful compilation

- [ ] **Step 7: Commit**

```bash
git add oracle/src/vision/engine.rs
git commit -m "feat(vision): add balance proof P2P aggregation for claimRewards/withdraw"
```

---

### Task 11: Integration Testing + Deployment

**Files:**
- No new files

- [ ] **Step 1: Build full oracle**

Run: `cd /Users/maxguillabert/Downloads/index && cargo build -p oracle`
Expected: Successful build

- [ ] **Step 2: Run existing tests**

Run: `cd /Users/maxguillabert/Downloads/index && cargo test -p oracle -- --nocapture`
Expected: All existing tests pass + new pending_ops tests pass

- [ ] **Step 3: Build contracts**

Run: `cd /Users/maxguillabert/Downloads/index && forge build --root contracts`
Expected: Successful compilation

- [ ] **Step 4: Pre-deploy: check stuck orders 26 & 27 DB state**

SSH to VPS and check DB:
```sql
SELECT order_id, status FROM vision_deposit_orders WHERE order_id IN (26, 27);
```
If status is `CreditedOnL3` but `depositProcessed[orderId]` is false on-chain, reset to `Pending`:
```sql
UPDATE vision_deposit_orders SET status = 'pending' WHERE order_id IN (26, 27) AND status = 'credited_on_l3';
```

- [ ] **Step 5: Deploy contracts (hard prereq)**

Deploy upgraded `Vision.sol` and `SettlementBridgeCustody.sol` to testnet. Verify on-chain:
1. `Vision.withdrawRequests(0)` returns `(address(0), 0)` — mapping exists
2. `SettlementBridgeCustody.REFUND_TIMEOUT()` returns `7200`
3. `SettlementBridgeCustody.depositCompleted(0)` returns `false` — mapping exists

- [ ] **Step 6: Build + sync oracle binary to VPS**

```bash
cargo build -p oracle --release
# sync to VPS
```

- [ ] **Step 7: Restart oracles via testnet.sh**

```bash
ssh index-maker/prod/be "cd /home/max/index && ./testnet.sh restart"
```

- [ ] **Step 8: Verify deposit flow E2E**

Deposit USDC on settlement, watch oracle logs for:
1. `VisionCreditBalanceProposal` broadcast
2. Signature collection from 2/3 oracles
3. `creditBalance` tx receipt — SUCCESS
4. `completeVisionDeposit` tx receipt — SUCCESS

- [ ] **Step 9: Commit final state**

```bash
git add -A
git commit -m "feat(vision): complete BLS consensus fix for deposit/withdraw operations"
```
