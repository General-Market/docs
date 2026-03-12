# Deposit Watcher BLS Consensus Fix — Design Spec

**Date**: 2026-03-12
**Status**: Approved (Rev 4 — passed 3/3 security reviewers with zero CRITICAL/HIGH)
**Scope**: `issuer/src/vision/deposit_watcher.rs`, `issuer/src/main.rs`, `issuer/src/consensus/protocol.rs`, `issuer/src/consensus/keys.rs`, `testnet.sh`, `contracts/src/custody/SettlementBridgeCustody.sol`, `contracts/src/vision/Vision.sol`

## Problem Statement

The `VisionDepositWatcher` has three critical bugs preventing all deposit/refund/withdraw operations:

### Bug 1: Single-Signer BLS (BelowThreshold revert)

`deposit_watcher.rs:712` signs with a single issuer:
```rust
let signer_bitmap = U256::one() << self.node_index;
```

The on-chain `BLSVerifier._verifyBLS()` requires `ceil(2n/3)` signers. With 3 issuers, 2 are needed. Single-signer always reverts with `BLSVerifier__BelowThreshold` (selector `0x2cfbe550`).

**Affected operations**: `creditBalance` (L3), `completeVisionDeposit` (Settlement), `refundVisionDeposit` (Settlement), `completeVisionWithdraw` (Settlement).

### Bug 2: Settlement RPC Points to Wrong Chain

The deposit watcher reads `lastSnapshotNonce()` from the L3 IssuerRegistry address (`0xEd89...`) via the settlement provider, which connects to Sonic (chain 14601, `http://127.0.0.1:8547`). The IssuerRegistry doesn't exist on Sonic, so the RPC call returns empty bytes (< 32), triggering `"Invalid response from lastSnapshotNonce"`.

**Root cause**: `config.rs:409` defaults `settlement_rpc_url` from `ISSUER_SETTLEMENT_RPC_URL`, but `main.rs:4694` passes the L3 IssuerRegistry address as both `l3_registry_address` and `settlement_registry_address`. The address is correct for L3 but not for Sonic.

**Fix**: The settlement registry address should be the `MirrorIssuerRegistry` on Sonic (`ISSUER_MIRROR_REGISTRY_ADDRESS=0x42FA8F399b2D4B078D1265370AB4e2B09CC8c952`), which IS deployed on the settlement chain. The deposit watcher constructor already accepts separate addresses — `main.rs:4694` just needs to pass the mirror registry address for settlement instead of reusing the L3 address.

### Bug 3: Cascading Failures

The above bugs cause:
- Infinite retry loops (every 1-3 seconds for 14+ hours)
- Nonce conflicts from concurrent retries
- `POSSIBLE NETWORK PARTITION` false positives from peer scoring
- Stuck deposits (orders 26, 27) that can't be credited OR refunded

## Design: Consensus-Driven Vision Ops (Approach C)

### Architecture

Vision deposit ops follow the same pattern as bridge consensus phases: an independent spawned task that drives consensus via `ConsensusProtocol` methods, NOT inline in `run_cycle()`.

```
┌─────────────────────┐     enqueue()      ┌──────────────────────┐
│  VisionDepositWatcher│───────────────────>│   PendingOpsQueue    │
│  (per-issuer task)   │<──────────────────│   (Arc<Mutex<...>>)  │
│                      │   poll_result()    │                      │
└─────────────────────┘                    └──────────┬───────────┘
                                                      │ drain (spawned task)
                                                      ▼
                                           ┌──────────────────────┐
                                           │  Vision Ops Task     │
                                           │  (spawned from main  │
                                           │   loop, guarded by   │
                                           │   AtomicBool flag)   │
                                           │                      │
                                           │  Leader:             │
                                           │   1. Drain queue     │
                                           │   2. For each op:    │
                                           │      a. Sign locally │
                                           │      b. Broadcast    │
                                           │         proposal     │
                                           │      c. Collect sigs │
                                           │      d. Read refNonce│
                                           │      e. Submit tx    │
                                           │      f. Write result │
                                           │                      │
                                           │  Follower:           │
                                           │   (via handle_msg)   │
                                           │   1. Receive proposal│
                                           │   2. Validate op     │
                                           │   3. Sign + return   │
                                           └──────────────────────┘
```

**Key architectural decision**: This is a spawned task from the main loop (like `run_cross_chain_processing`, `run_itp_creation_phase`), NOT code injected into `run_cycle()`. It uses `ConsensusProtocol` methods directly. Followers participate reactively via `handle_message()` routing.

### Component 1: PendingOpsQueue (new file)

**File**: `issuer/src/vision/pending_ops.rs`

A thread-safe queue shared between the deposit watcher and the consensus cycle.

```rust
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

pub enum OpStatus {
    /// Queued, not yet picked up by the consensus task.
    Queued,
    /// Currently being processed by the consensus task (prevents re-enqueue).
    InProgress,
}

pub enum OpResult {
    Success { tx_hash: H256 },
    /// Permanent failure — will not be retried (e.g., AlreadyProcessed).
    Permanent { reason: String },
    Failed { error: String },
    Pending,
}

pub struct PendingOpsQueue {
    /// Ops waiting to be picked up by the consensus cycle, with their status.
    pending: Mutex<Vec<(VisionOp, OpStatus)>>,
    /// Results written by the consensus cycle, keyed by (op_type, id).
    results: Mutex<HashMap<(String, u64), OpResult>>,
}
```

**Interface**:
- `enqueue(op: VisionOp)` — deposit watcher submits work (status: `Queued`)
- `drain_pending(max: usize) -> Vec<VisionOp>` — consensus cycle takes up to `max` ops, transitions them to `InProgress`
- `cancel_pending(op_type, id)` — remove a queued op (used for mutual exclusion, see below)
- `write_result(op_type, id, result)` — consensus cycle writes outcome, removes from pending
- `poll_result(op_type, id) -> Option<OpResult>` — deposit watcher checks outcome
- `clear_result(op_type, id)` — deposit watcher clears after processing

**Deduplication**: `enqueue` skips if an op with the same `(type, id)` is already in `Queued`, `InProgress`, or has a `Pending` result. This prevents the deposit watcher's retry loop from flooding the queue.

**InProgress guard**: `drain_pending()` transitions ops from `Queued` to `InProgress` atomically. Ops in `InProgress` cannot be re-enqueued until the consensus task writes a result (or the TTL expires and prunes them). This eliminates the race between enqueue/drain/poll that could cause duplicate processing.

**Bounded drain**: `drain_pending(max)` takes at most `max` ops (default: 5). This prevents unbounded queue drain from blocking the consensus cycle with too many sequential on-chain submissions. Remaining ops stay queued for the next cycle.

**Mutual exclusion**: `CreditBalance` and `RefundDeposit` for the same `order_id` MUST NOT coexist in the same batch. When `drain_pending()` encounters both, it keeps only the `CreditBalance` (credit takes priority — the deposit watcher's timeout logic will re-enqueue `RefundDeposit` if credit fails). Additionally, after a successful `CreditBalance` submission, the leader calls `cancel_pending("refund", order_id)` to remove any queued refund for the same order.

**TTL**: Results older than 60 seconds are automatically pruned on `poll_result()`. InProgress ops older than 600 seconds are pruned back to allow re-enqueue. The 600s TTL accounts for worst-case batch processing: 5 ops × (5s sign timeout + ~30s tx receipt + ~30s RPC delays + buffer). The TTL is per-op from when that specific op transitions to `InProgress` (not from drain time). The deposit watcher must handle missing results gracefully (re-enqueue on next loop). This prevents unbounded growth if results are never consumed (e.g., after crash).

**Multi-node dedup**: All 3 issuers independently detect the same deposit and enqueue the same ops locally. Only the leader drains the queue and drives consensus. After the leader submits successfully on-chain, follower deposit watchers detect the state change via their existing on-chain checks (`is_deposit_processed_on_l3()`, etc.) and advance their state machines in the next polling loop. The `OpResult` is only written to the leader's local queue.

### Component 2: Consensus Protocol Extension

**File**: `issuer/src/consensus/protocol.rs`, `issuer/src/consensus/messages.rs`

Follow the established bridge consensus pattern: one proposal/sign message pair per operation type. Use `bridge_proposal_handler!` / `bridge_sign_handler!` macros from `handler_macros.rs` where applicable.

#### New P2P Messages (4 pairs, one per op type)

Each op type gets its own message pair, matching the existing pattern (e.g., `BridgeSettlementToL3Proposal`/`BridgeSettlementToL3Sign`):

```rust
// creditBalance on L3
VisionCreditBalanceProposal { cycle: u64, order_id: u64, user: Address, amount: U256, message_hash: H256, leader_signature: Vec<u8> }
VisionCreditBalanceSign { cycle: u64, order_id: u64, signature: Vec<u8>, signer_index: u8 }

// completeVisionDeposit on Settlement
VisionCompleteDepositProposal { cycle: u64, order_id: u64, message_hash: H256, leader_signature: Vec<u8> }
VisionCompleteDepositSign { cycle: u64, order_id: u64, signature: Vec<u8>, signer_index: u8 }

// refundVisionDeposit on Settlement
VisionRefundDepositProposal { cycle: u64, order_id: u64, message_hash: H256, leader_signature: Vec<u8> }
VisionRefundDepositSign { cycle: u64, order_id: u64, signature: Vec<u8>, signer_index: u8 }

// completeVisionWithdraw on Settlement
VisionCompleteWithdrawProposal { cycle: u64, withdraw_id: u64, user: Address, amount: U256, message_hash: H256, leader_signature: Vec<u8> }
VisionCompleteWithdrawSign { cycle: u64, withdraw_id: u64, signature: Vec<u8>, signer_index: u8 }
```

**Sign message correlation**: All Sign messages include the `order_id` (or `withdraw_id`) so the leader can verify the response corresponds to the current operation. The leader MUST discard sign messages whose `order_id` doesn't match the operation currently being aggregated.

**Note**: Operations are processed one at a time (not batched). This matches the existing codebase pattern where every bridge consensus phase signs exactly one operation. Given deposits are rare events, the simplicity is worth the extra round-trips.

**signer_index derivation**: The leader MUST derive `signer_index` from `extract_issuer_id(&from)` (the authenticated P2P peer identity), NOT from the self-reported `signer_index` field in the Sign message. The self-reported field is informational only. This follows the pattern used in `handle_itp_creation_sign()` (protocol.rs:3771). **Do NOT use the `bridge_sign_handler!` macro** for vision sign handlers — the macro passes through `signer_index` without validation. Write custom handlers that derive the index from peer identity. This prevents:
- Griefing: a follower claiming to be a different signer, causing the aggregated bitmask to be wrong
- DoS: a follower overwriting another follower's real signature in the aggregator

**Per-operation aggregator**: Each vision op MUST use a fresh `SignatureAggregator` instance, NOT the shared protocol-level aggregator. Create a new aggregator before broadcasting each proposal, and reset it between sequential ops in the same batch. This prevents cross-operation signature confusion where late-arriving sign messages from a previous operation are mistakenly counted toward the current operation.

#### Vision Ops Task (spawned from main loop)

This is an independent `tokio::spawn` task, guarded by a `vision_ops_active: Arc<AtomicBool>` flag, spawned from the main loop's settlement-poll section (alongside ITP creation, bridge processing, etc.).

**Leader flow** (per task invocation, processes one op at a time):

1. `drain_pending(5)` from `PendingOpsQueue` (max 5 ops per invocation)
2. If empty, return
3. **Pre-flight**: Check `MirrorIssuerRegistry` is synced — call `mirrorRegistry.lastSnapshotNonce()` and compare with `l3Registry.lastSnapshotNonce()`. If nonces mismatch, log error, write `OpResult::Failed` for all drained ops, return. Nonce comparison is more precise than `totalRegistered()` count comparison because it detects key rotations where the count stays the same but keys change. Also verify `totalRegistered >= 3` (minimum deployment size) to prevent degenerate single-signer thresholds.
4. For each op (sequentially, respecting deposit state ordering):
   a. **Leader dedup check**: Before signing, verify the op hasn't already been executed on-chain (e.g., call `depositProcessed[orderId]` for CreditBalance). If already processed, write `OpResult::Permanent { reason: "AlreadyProcessed" }` and skip.
   b. Sign the `message_hash` with own BLS keypair
   c. Broadcast proposal (e.g., `VisionCreditBalanceProposal`) via `protocol.p2p.broadcast()`
   d. Collect signatures via `SignatureAggregator` with `sign_timeout_ms` deadline
   e. When threshold reached: aggregate BLS signatures, compute `signers_bitmask`
   f. Read `referenceNonce` from appropriate chain (L3 → `ConsensusKeys.registry_nonce()`, Settlement → `ConsensusKeys.settlement_registry_nonce()`)
   g. Build calldata with aggregated signature + referenceNonce + signersBitmask
   h. Submit on-chain tx via chain writer
   i. **Wait for tx receipt** — do NOT advance until receipt confirms success
   j. **Classify revert**: If tx reverts, decode the revert selector:
      - `AlreadyProcessed` / `DepositAlreadyProcessed` (L3 Vision) → `OpResult::Permanent`
      - `E131_VisionDepositNotFound` (Settlement — deposit record already deleted by prior complete or refund) → `OpResult::Permanent`
      - `E132_VisionWithdrawAlreadyProcessed` (Settlement) → `OpResult::Permanent`
      - `BelowThreshold` → `OpResult::Failed` (will be retried — likely config issue)
      - Other → `OpResult::Failed` with decoded reason
   k. On success: write `OpResult::Success { tx_hash }`, then `cancel_pending("refund", order_id)` if this was a CreditBalance (cancel any queued refund for same order)
5. **Ordering rule**: `CreditBalance` ops MUST be processed and confirmed before `CompleteDeposit` ops for the same `order_id`. Sort ops: all CreditBalance first, then CompleteDeposit/RefundDeposit/CompleteWithdraw. **RPC propagation delay**: After confirming a `CreditBalance` on L3, wait 3 seconds before broadcasting the `CompleteDeposit` proposal for the same order. This gives follower RPC endpoints time to index the L3 tx, preventing transient `depositProcessed == false` rejections that would waste a consensus round.
6. **Mutual exclusion enforcement**: During sorting (step 5), if both `CreditBalance` and `RefundDeposit` exist for the same `order_id`, drop the `RefundDeposit` from the batch (return it to queue as `Queued`).

**Follower flow** (reactive via `handle_message()`):

1. Receive proposal message (e.g., `VisionCreditBalanceProposal`)
2. Validate: recompute `message_hash` from op params using own config's `chain_id`, `vision_address`, `custody_address`
3. Verify leader BLS signature on `message_hash`
4. Sign `message_hash` with own BLS keypair
5. Send sign message back to leader

#### referenceNonce Handling

The `referenceNonce` is NOT part of the `message_hash` (the BLS-signed content). It is a separate parameter in the contract call. The leader reads it at submission time (step 3e), not at enqueue time — this avoids staleness if another consensus op takes a snapshot between enqueue and submission. The leader uses:
- `ConsensusKeys.registry_nonce()` for L3 operations (creditBalance)
- `ConsensusKeys.settlement_registry_nonce()` for Settlement operations (completeDeposit, refundDeposit, completeWithdraw)

#### Validation (Follower)

Followers MUST independently verify each operation before signing. **All checks below marked MANDATORY are hard requirements — a follower MUST refuse to sign if any MANDATORY check fails.** There are no optional checks.

- **CreditBalance**:
  1. MANDATORY: Verify `message_hash == keccak256(abi.encode(chainId, visionAddress, "creditBalance", user, amount, depositId))` using follower's own config values.
  2. MANDATORY: Verify deposit exists on settlement chain — call `SettlementBridgeCustody.visionDeposits(orderId)` and confirm `deposit.amount == proposal.amount` (exact match, not just > 0) and `deposit.user == proposal.user`. **A `> 0` check is insufficient — a malicious leader could propose an inflated amount and sign it. The exact match prevents both fabricated and inflated credits.**
  3. MANDATORY: Verify `depositProcessed[orderId]` is false on L3 — prevents double-crediting.

- **CompleteDeposit**:
  1. MANDATORY: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "completeVisionDeposit", orderId))`.
  2. MANDATORY: Check `depositProcessed[orderId]` is true on L3 (credit must land before completion). **Retry with backoff**: if the check returns false, retry up to 3 times with 2-second intervals before rejecting. This handles L3 RPC propagation delay (the leader confirmed the CreditBalance but the follower's RPC hasn't indexed it yet). Without retry, persistent RPC lag can permanently block CompleteDeposit consensus.
  3. MANDATORY: Verify `visionDeposits[orderId].user != address(0)` on Settlement — the deposit record must still exist (not already completed or refunded). This prevents a malicious leader from flooding the queue with stale CompleteDeposit proposals for already-processed deposits (DoS via wasted consensus rounds).

- **RefundDeposit**:
  1. MANDATORY: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "refundVisionDeposit", orderId))`.
  2. MANDATORY: Verify deposit exists on settlement — `SettlementBridgeCustody.visionDeposits(orderId).amount > 0`.
  3. MANDATORY: Verify `depositProcessed[orderId]` is false on L3 — **if the deposit was already credited, refunding would be a double-spend** (user keeps L3 balance AND gets USDC back).
  4. MANDATORY: Verify deposit age exceeds refund timeout — `block.timestamp - deposit.timestamp > REFUND_TIMEOUT`. `REFUND_TIMEOUT` MUST be a compile-time constant (e.g., `const REFUND_TIMEOUT: u64 = 7200;`), NOT a per-node runtime config value. All issuers must agree on the same timeout; a per-node config violates consensus safety (a compromised operator could set it to 0). This prevents premature refunds while credit consensus is still in progress.

- **CompleteWithdraw**:
  1. MANDATORY: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "completeVisionWithdraw", withdrawId, user, amount))`.
  2. MANDATORY: Verify the withdrawal request exists on L3 — call `Vision.withdrawRequests(withdrawId)` and confirm `request.user == proposal.user` and `request.amount == proposal.amount`. **Requires contract change**: see Required Contract Changes section below.

**Identity binding**: The `chain_id`, `vision_address`, and `custody_address` used for hash verification come from the follower's own config, not the proposal — this prevents a malicious leader from forging operations.

**signer_index validation**: The leader MUST validate `signer_index` in received Sign messages against the authenticated peer identity (from the P2P layer's peer ID → issuer index mapping). A Sign message claiming `signer_index=2` from a peer known to be issuer 0 MUST be rejected. This prevents signature attribution spoofing.

### Component 3: Deposit Watcher Changes

**File**: `issuer/src/vision/deposit_watcher.rs`

**Remove**: `bls_keypair`, `bls_signer`, `node_index`, `l3_chain_writer`, `settlement_chain_writer`, `l3_registry_address`, `settlement_registry_address` fields. The deposit watcher no longer signs, reads nonces, or submits transactions.

**Add**: `ops_queue: Arc<PendingOpsQueue>` field.

**Change the signing methods**:
- `sign_and_submit_credit_balance()` → `request_credit_balance()`: compute message hash, `enqueue(CreditBalance { ... })`, return immediately
- `sign_and_submit_complete_deposit()` → `request_complete_deposit()`: same pattern
- `sign_and_submit_refund_deposit()` → `request_refund_deposit()`: same pattern
- `sign_and_submit_complete_withdraw()` → `request_complete_withdraw()`: same pattern

**Change the state machine** (`process_pending_deposits`, `process_pending_withdrawals`):
- On first visit to an actionable state: enqueue the op
- On subsequent visits: `poll_result()`:
  - `Success { tx_hash }` → **verify on-chain state before advancing** (e.g., for CreditBalance, read `depositProcessed[orderId]` on L3 to confirm it's true). Only advance state after on-chain confirmation. This eliminates the optimistic state advance bug.
  - `Permanent { reason }` → log, clear result, advance state (e.g., `AlreadyProcessed` means it's done). Do NOT re-enqueue.
  - `Failed { error }` → log, clear result, will re-enqueue next loop.
  - `Pending` → skip (wait for consensus cycle).
  - `None` (result expired or missing) → re-enqueue on next loop.

**No optimistic state advance**: The deposit watcher MUST NOT advance to `CreditedOnL3` until it has verified `depositProcessed[orderId] == true` on L3 (via an RPC read, not from the tx receipt alone). This is a defense-in-depth measure — even if the tx receipt says success, the on-chain state is the source of truth.

**Remove**: `get_reference_nonce()` — the consensus task reads the nonce, not the deposit watcher.

**Keep**: `drip_gas_if_needed()` — the gas drip is a plain native transfer (not BLS-verified), so the deposit watcher continues to call it locally after seeing a successful `CreditBalance` result via `poll_result()`.

**Security note**: The `message_hash` in the queue is computed by the local deposit watcher. The leader's consensus task MUST independently recompute the `message_hash` from the op params using its own config (`chain_id`, `vision_address`, `custody_address`) and compare against the queued hash. If they mismatch, reject the op with `OpResult::Failed { error: "message_hash mismatch — config inconsistency" }`. This catches configuration bugs early (e.g., wrong `custody_address` in deposit watcher vs consensus task config). The follower's independent recomputation is the ultimate security boundary.

### Component 4: Settlement Registry Fix

**File**: `issuer/src/main.rs` (lines 4680-4694)

Change the deposit watcher initialization to use the correct settlement registry:

```rust
// L3 registry for L3 operations (creditBalance)
let dw_l3_registry: Address = issuer_registry_address_str
    .as_ref()
    .and_then(|addr| addr.parse().ok())
    .unwrap_or(Address::zero());

// Settlement registry for settlement operations (mirror registry on Sonic)
let dw_settlement_registry: Address = mirror_registry_address
    .unwrap_or(dw_l3_registry);  // fallback to L3 registry if no mirror
```

**Note**: With the Approach C design, the deposit watcher no longer reads `lastSnapshotNonce` directly — the consensus protocol does. But the consensus protocol's `_verifyBLS` call still needs the correct `referenceNonce`. The leader should read it from the appropriate chain:
- L3 ops: read from L3 IssuerRegistry via `consensus_chain_reader`
- Settlement ops: read from MirrorIssuerRegistry via settlement provider

The existing `ConsensusKeys.registry_nonce()` and `settlement_registry_nonce()` already track these separately.

### Component 5: testnet.sh Fix

**File**: `testnet.sh`

Add `--vision-settlement-rpc-url` to issuer command generation. Currently only `--vision-settlement-bridge-custody` is passed. Add:

```yaml
- "--vision-settlement-rpc-url"
- "$SETTLEMENT_RPC_VPS"
```

This ensures the Vision deposit watcher's settlement provider connects to the correct Sonic RPC proxy (`http://127.0.0.1:8547`).

### Wiring: main.rs Changes

1. Create `PendingOpsQueue` as `Arc<PendingOpsQueue>` before spawning deposit watcher
2. Pass `Arc::clone(&ops_queue)` to deposit watcher constructor
3. In the main loop's settlement-poll section (alongside ITP/bridge spawns): add a `vision_ops_active: Arc<AtomicBool>` guard and spawn the vision ops consensus task when the queue is non-empty
4. The spawned task receives: `protocol.clone()`, `ops_queue.clone()`, `consensus_chain_writer` (L3), `settlement_chain_writer`, `consensus_keys` (for referenceNonce), and config addresses

### Component 6: Nonce Monotonicity Guards

**File**: `issuer/src/consensus/keys.rs`

**Critical**: `InMemoryKeyRegistry` has TWO implementations of each nonce setter — an inherent method and a `KeyRegistry` trait impl. Callers using `dyn KeyRegistry` or `impl KeyRegistry` dispatch to the TRAIT impl, which bypasses any guard in the inherent method. **Both implementations must have the monotonicity guard.**

Currently broken (BOTH L3 and settlement):
- Inherent `set_registry_nonce` (line 100): has guard ✓
- Trait `set_registry_nonce` (line 181): NO guard ✗
- Inherent `set_settlement_registry_nonce` (line 109): NO guard ✗
- Trait `set_settlement_registry_nonce` (line 191): NO guard ✗

**Fix**: Add `if nonce > *guard` to ALL FOUR nonce setters. Or better: remove the inherent methods entirely and keep only the trait impls (both with guards), eliminating the shadowing confusion.

```rust
// In impl KeyRegistry for InMemoryKeyRegistry:
fn set_registry_nonce(&self, nonce: u64) {
    if let Ok(mut guard) = self.nonce.write() {
        if nonce > *guard { *guard = nonce; }
    }
}

fn set_settlement_registry_nonce(&self, nonce: u64) {
    if let Ok(mut guard) = self.settlement_registry_nonce.write() {
        if nonce > *guard { *guard = nonce; }
    }
}
```

This prevents a race where a stale RPC response overwrites a newer nonce, which would cause all subsequent BLS submissions to use an outdated `referenceNonce` and revert.

### Component 7: Chain ID Configuration

**File**: `issuer/src/vision/deposit_watcher.rs`

Replace the hardcoded L3 chain ID `111_222_333` with a config value:

```rust
// Before (line 486):
let chain_id = 111_222_333u64;

// After:
let chain_id = self.config.l3_chain_id;  // from CLI flag / env var
```

The chain ID is used in `message_hash` computation. A hardcoded value would break if the chain ID ever changes (e.g., mainnet deployment). Read from the same config source as the rest of the issuer.

### Error Handling

- **Timeout**: If no threshold reached within `sign_timeout_ms` (default 5000ms from config), write `OpResult::Failed` with timeout message
- **Partial signatures**: If some followers don't respond but threshold is reached, proceed with available signatures
- **On-chain revert**: After submitting, decode the revert selector (see leader flow step 4j). `AlreadyProcessed` → `OpResult::Permanent`. Other → `OpResult::Failed` for retry.
- **Leader rotation**: If the leader changes mid-cycle, pending ops stay in the queue and the new leader picks them up next cycle. At most 1 second delay.
- **Dual-leader tolerance**: If two nodes briefly believe they are leader (during rotation), both may attempt the same op. For `CreditBalance`: on-chain `depositProcessed` guard makes the second submission revert with `AlreadyProcessed` → `Permanent`. For settlement ops: `E131_VisionDepositNotFound` / `E132_VisionWithdrawAlreadyProcessed` → `Permanent`. The leader SHOULD check on-chain state before signing (step 4a) to avoid unnecessary consensus rounds. **Critical**: the credit+refund dual-leader race (where one leader credits, the other refunds the same deposit) is prevented by the combination of follower `depositProcessed` check + on-chain `REFUND_TIMEOUT` in `SettlementBridgeCustody` (see Required Contract Changes).

### Cross-Chain Atomicity Recovery

**Problem**: `creditBalance` (L3) succeeds but `completeVisionDeposit` (Settlement) permanently fails. The user has L3 balance but the USDC is still locked in `SettlementBridgeCustody`, and `visionReserve` accounting is wrong.

**Recovery mechanism**: The deposit watcher's state machine handles this naturally:
1. After `CreditBalance` success → state advances to `CreditedOnL3`
2. Deposit watcher enqueues `CompleteDeposit` on next loop
3. If `CompleteDeposit` fails (e.g., gas, nonce), it stays in `CreditedOnL3` state and re-enqueues
4. Retry continues indefinitely (no max retry count) — the USDC MUST be released eventually

**Backstop**: If `CompleteDeposit` keeps failing for >24 hours (configurable), the deposit watcher logs a `CRITICAL` alert with the order_id and amounts. The on-chain `completeVisionDeposit` is safe to retry — it deletes the deposit record and transfers USDC to the reserve, which is idempotent (if the deposit record is already deleted, the call reverts, which is fine).

**What we do NOT do**: We do NOT refund a deposit that has already been credited on L3. The `RefundDeposit` follower validation (check 3) ensures followers refuse to sign a refund for a deposit where `depositProcessed[orderId] == true` on L3. This prevents the credit+refund double-spend.

### Migration Path for Stuck Orders 26 & 27

**Pre-deploy check**: Verify actual DB state for orders 26/27. The current code optimistically advances to `CreditedOnL3` before confirming the tx receipt (lines 511-520). If the DB shows `CreditedOnL3` but `depositProcessed[orderId]` is false on L3, reset the DB state to `Pending` before restarting.

After deploying the fix:
1. Issuers restart, deposit watcher reloads pending deposits from DB
2. Orders 26 & 27 should be in `Pending` state (verified/reset above)
3. Deposit watcher enqueues `CreditBalance` for both
4. Vision ops task picks them up, collects 2/3 signatures, submits
5. If `AlreadyProcessed` revert → `OpResult::Permanent` → deposit watcher reads on-chain state and advances accordingly (no infinite retry)
6. If `BelowThreshold` still → configuration issue, check logs
7. Auto-refund logic stays as fallback: if deposits are stuck > 2 hours after the fix, they get refunded through the consensus path (with the follower's mandatory `depositProcessed` check preventing double-spend)

### What This Doesn't Change

- Vision tick consensus (`engine.rs`) — already has its own multi-issuer flow via `TickConsensus`
- Price consensus — untouched
- ITP/bridge consensus — untouched

### Known Issue: Balance Proofs (claimRewards / withdraw from batch)

**Balance proofs are ALSO single-signer** (`engine.rs:511`: `U256::one() << config.node_index`). Each issuer independently signs balance proofs and stores them in its own DB. The player fetches from one issuer's API and submits on-chain, where `_verifyBLS` requires 2/3 threshold → `BelowThreshold` revert.

**This is a SEPARATE fix** from the deposit watcher consensus, because the player (not the issuer) submits the transaction. The fix requires aggregating BLS signatures from multiple issuers before serving the proof to the player. Recommended approach: add a tick-end consensus phase that aggregates balance proof signatures across issuers. This will be covered in a separate spec.

## Testing

1. **Unit test**: `PendingOpsQueue` enqueue/drain/dedup/result lifecycle
2. **Integration test**: Mock 3-issuer consensus with deposit op → verify aggregated signature meets threshold
3. **E2E**: Deposit flow on testnet — deposit USDC on settlement, verify `creditBalance` succeeds with 2/3 BLS sig, verify `completeVisionDeposit` succeeds

## Immediate Fix (deploy independently)

`testnet.sh`: Add `--vision-settlement-rpc-url` to issuer config. This fixes Bug 2 immediately and stops the `Invalid response from lastSnapshotNonce` infinite retry loops, even though Bug 1 (BelowThreshold) still prevents actual success.

## Security Invariants

These are the hard security invariants that MUST hold. Implementation MUST NOT weaken any of these:

1. **No unbacked credits**: `CreditBalance` followers MUST verify the deposit exists on settlement with **exact** matching `amount` and `user` before signing. A `> 0` check is NOT sufficient — it must be `== proposal.amount`.
2. **No credit+refund double-spend**: `RefundDeposit` followers MUST verify `depositProcessed[orderId] == false` on L3 before signing. If the deposit was already credited, refunding it would give the user both L3 balance AND USDC back. On-chain refund timeout provides defense-in-depth (see Required Contract Changes).
3. **No optimistic state advance**: The deposit watcher MUST verify on-chain state (not just tx receipt) before advancing its state machine. `depositProcessed[orderId]` on L3 is the source of truth for CreditBalance success.
4. **No stale nonce rollback**: Both L3 and settlement nonce setters MUST enforce monotonicity — never overwrite a higher nonce with a lower one.
5. **Peer identity derivation**: `signer_index` MUST be derived from `extract_issuer_id(&from)` (authenticated P2P peer identity). Never trust the self-reported field. Do NOT use `bridge_sign_handler!` macro (it doesn't validate).
6. **BLS threshold**: All vision ops go through 2/3 consensus. No single-signer bypass paths, no test modes, no admin overrides. Minimum `totalRegistered >= 3`.
7. **Permanent revert classification**: On-chain idempotency reverts — `AlreadyProcessed`, `DepositAlreadyProcessed`, `E131_VisionDepositNotFound`, `E132_VisionWithdrawAlreadyProcessed` — MUST all be classified as `OpResult::Permanent`. Infinite retry on these wastes resources and blocks the queue.
8. **MirrorRegistry sync**: The leader MUST verify `MirrorIssuerRegistry.lastSnapshotNonce()` matches L3 before submitting settlement ops.
9. **Per-operation aggregator**: Each vision op MUST use a fresh `SignatureAggregator`, not the shared protocol-level one. Cross-operation signature confusion is a real risk with sequential processing.
10. **Sign message correlation**: Sign messages MUST include `order_id`/`withdraw_id`. The leader MUST discard responses whose ID doesn't match the current operation.
11. **REFUND_TIMEOUT is a constant**: The refund timeout MUST be a compile-time constant, identical across all nodes. Per-node runtime config violates consensus safety.
12. **Leader recomputes message_hash**: The consensus task MUST independently recompute `message_hash` from op params + own config, and reject if it doesn't match the queued hash.

## Deployment Order

**The contract changes below are HARD PREREQUISITES.** They MUST be deployed and verified on-chain BEFORE the issuer fix goes live. Deploying the issuer fix without the contract changes opens fund-theft attack vectors:

1. Deploy `Vision.sol` upgrade (add `withdrawRequests` mapping) → verify on-chain
2. Deploy `SettlementBridgeCustody.sol` upgrade (add `REFUND_TIMEOUT`, `depositCompleted`) → verify on-chain
3. Deploy issuer fix → restart issuers

**Fail-closed behavior**: The issuer follower validation code MUST call the new contract functions (`withdrawRequests()`, `depositCompleted()`). If the RPC returns an error (including "function not found" because the contract hasn't been upgraded yet), the follower MUST refuse to sign. This is fail-closed by default — a missing function is treated as a validation failure, never as "skip the check."

**No partial deployment**: The issuer code MUST NOT selectively enable operation types. All 4 operation types (CreditBalance, CompleteDeposit, RefundDeposit, CompleteWithdraw) go through consensus together. The contract changes must all be live before any of them are enabled.

## Required Contract Changes

These contract changes are prerequisites for the issuer fix. They close security gaps that cannot be mitigated by off-chain logic alone.

### 1. On-chain refund timeout (`SettlementBridgeCustody`)

Add a minimum age check to `refundVisionDeposit`:
```solidity
require(block.timestamp - dep.createdAt > REFUND_TIMEOUT, "E133_RefundTooEarly");
```
**Why required (not optional)**: The TOCTOU window between follower validation and on-chain execution means off-chain timeout enforcement alone cannot prevent credit+refund double-spend under dual-leader race conditions. The on-chain check is the only atomic guard.

### 2. Withdrawal request storage (`Vision.sol`)

Add an on-chain mapping for withdrawal requests so followers can verify `CompleteWithdraw` proposals:
```solidity
struct WithdrawRequest { address user; uint256 amount; }
mapping(uint256 => WithdrawRequest) public withdrawRequests;
```
Set in `withdrawToSettlement()`, read by followers via `eth_call`, cleared in the withdrawal completion path. Without this, followers cannot securely verify withdrawal existence — event log queries are not reliable for security validation.

### 3. Deposit completion tracking (`SettlementBridgeCustody`)

Add a `depositCompleted[orderId]` boolean mapping, set to true in `completeVisionDeposit`. This disambiguates "completed" from "refunded" (both currently delete the deposit record and revert with `E131_VisionDepositNotFound`). Also enables followers to skip `CompleteDeposit` consensus rounds for already-completed deposits.

## Out of Scope

- **`visionReserve` accounting model**: The reserve tracks gross USDC held for Vision virtual balances. `completeVisionDeposit` intentionally does not decrement it (USDC stays in custody to back the user's L3 balance). The truncation guard in `completeVisionWithdraw` (`if usdcAmount > visionReserve`) is a separate concern — it should arguably revert instead of silently truncating, but that's a contract-level design decision outside this issuer fix. A separate audit of reserve solvency under high-PnL scenarios is recommended.

## Files Changed (BLS consensus fix)

| File | Change |
|------|--------|
| `issuer/src/vision/pending_ops.rs` | **New** — PendingOpsQueue + VisionOp + OpResult + OpStatus, bounded drain, mutual exclusion, InProgress guard |
| `issuer/src/vision/mod.rs` | Add `pub mod pending_ops;` |
| `issuer/src/vision/deposit_watcher.rs` | Remove BLS signing fields, add queue-based submission, on-chain verification before state advance, configurable chain_id, keep gas drip |
| `issuer/src/consensus/protocol.rs` | Add 4 consensus phase methods with per-op aggregators, signer_index derivation from peer identity (NOT macro), pre-flight MirrorRegistry nonce check, revert classification |
| `issuer/src/consensus/messages.rs` | Add 8 new message types (4 proposal + 4 sign, sign messages include order_id for correlation) |
| `issuer/src/consensus/handler_macros.rs` | Register new proposal handlers only (sign handlers are custom, not macro-generated) |
| `contracts/src/custody/SettlementBridgeCustody.sol` | Add on-chain `REFUND_TIMEOUT` check in `refundVisionDeposit`, add `depositCompleted` mapping |
| `contracts/src/vision/Vision.sol` | Add `withdrawRequests` mapping in `withdrawToSettlement` |
| `issuer/src/consensus/keys.rs` | Add monotonicity guard to ALL FOUR nonce setters (both inherent + trait impls, both L3 + settlement) |
| `issuer/src/main.rs` | Wire PendingOpsQueue, spawn vision ops task, fix settlement registry address |
| `testnet.sh` | Add `--vision-settlement-rpc-url` to issuer config |
