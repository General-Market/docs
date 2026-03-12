# Deposit Watcher BLS Consensus Fix — Design Spec

**Date**: 2026-03-12
**Status**: Draft
**Scope**: `issuer/src/vision/deposit_watcher.rs`, `issuer/src/main.rs`, `issuer/src/consensus/protocol.rs`, `testnet.sh`

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

pub enum OpResult {
    Success { tx_hash: H256 },
    Failed { error: String },
    Pending,
}

pub struct PendingOpsQueue {
    /// Ops waiting to be picked up by the consensus cycle.
    pending: Mutex<Vec<VisionOp>>,
    /// Results written by the consensus cycle, keyed by (op_type, id).
    results: Mutex<HashMap<(String, u64), OpResult>>,
}
```

**Interface**:
- `enqueue(op: VisionOp)` — deposit watcher submits work
- `drain_pending() -> Vec<VisionOp>` — consensus cycle takes all pending ops
- `write_result(op_type, id, result)` — consensus cycle writes outcome
- `poll_result(op_type, id) -> Option<OpResult>` — deposit watcher checks outcome
- `clear_result(op_type, id)` — deposit watcher clears after processing

**Deduplication**: `enqueue` skips if an op with the same `(type, id)` is already pending or has a `Pending` result. This prevents the deposit watcher's retry loop from flooding the queue.

**TTL**: Results older than 60 seconds are automatically pruned on `poll_result()`. The deposit watcher must handle missing results gracefully (re-enqueue on next loop). This prevents unbounded growth if results are never consumed (e.g., after crash).

**Multi-node dedup**: All 3 issuers independently detect the same deposit and enqueue the same ops locally. Only the leader drains the queue and drives consensus. After the leader submits successfully on-chain, follower deposit watchers detect the state change via their existing on-chain checks (`is_deposit_processed_on_l3()`, etc.) and advance their state machines in the next polling loop. The `OpResult` is only written to the leader's local queue.

### Component 2: Consensus Protocol Extension

**File**: `issuer/src/consensus/protocol.rs`, `issuer/src/consensus/messages.rs`

Follow the established bridge consensus pattern: one proposal/sign message pair per operation type. Use `bridge_proposal_handler!` / `bridge_sign_handler!` macros from `handler_macros.rs` where applicable.

#### New P2P Messages (4 pairs, one per op type)

Each op type gets its own message pair, matching the existing pattern (e.g., `BridgeSettlementToL3Proposal`/`BridgeSettlementToL3Sign`):

```rust
// creditBalance on L3
VisionCreditBalanceProposal { cycle: u64, order_id: u64, user: Address, amount: U256, message_hash: H256, leader_signature: Vec<u8> }
VisionCreditBalanceSign { cycle: u64, signature: Vec<u8>, signer_index: u8 }

// completeVisionDeposit on Settlement
VisionCompleteDepositProposal { cycle: u64, order_id: u64, message_hash: H256, leader_signature: Vec<u8> }
VisionCompleteDepositSign { cycle: u64, signature: Vec<u8>, signer_index: u8 }

// refundVisionDeposit on Settlement
VisionRefundDepositProposal { cycle: u64, order_id: u64, message_hash: H256, leader_signature: Vec<u8> }
VisionRefundDepositSign { cycle: u64, signature: Vec<u8>, signer_index: u8 }

// completeVisionWithdraw on Settlement
VisionCompleteWithdrawProposal { cycle: u64, withdraw_id: u64, user: Address, amount: U256, message_hash: H256, leader_signature: Vec<u8> }
VisionCompleteWithdrawSign { cycle: u64, signature: Vec<u8>, signer_index: u8 }
```

**Note**: Operations are processed one at a time (not batched). This matches the existing codebase pattern where every bridge consensus phase signs exactly one operation. Given deposits are rare events, the simplicity is worth the extra round-trips.

#### Vision Ops Task (spawned from main loop)

This is an independent `tokio::spawn` task, guarded by a `vision_ops_active: Arc<AtomicBool>` flag, spawned from the main loop's settlement-poll section (alongside ITP creation, bridge processing, etc.).

**Leader flow** (per task invocation, processes one op at a time):

1. `drain_pending()` from `PendingOpsQueue`
2. If empty, return
3. For each op (sequentially, respecting deposit state ordering):
   a. Sign the `message_hash` with own BLS keypair
   b. Broadcast proposal (e.g., `VisionCreditBalanceProposal`) via `protocol.p2p.broadcast()`
   c. Collect signatures via `SignatureAggregator` with `sign_timeout_ms` deadline
   d. When threshold reached: aggregate BLS signatures, compute `signers_bitmask`
   e. Read `referenceNonce` from appropriate chain (L3 → `ConsensusKeys.registry_nonce()`, Settlement → `ConsensusKeys.settlement_registry_nonce()`)
   f. Build calldata with aggregated signature + referenceNonce + signersBitmask
   g. Submit on-chain tx via chain writer
   h. Write `OpResult::Success { tx_hash }` or `OpResult::Failed { error }` to queue
4. **Ordering rule**: `CreditBalance` ops MUST be processed and confirmed before `CompleteDeposit` ops for the same `order_id`. Sort ops: all CreditBalance first, then CompleteDeposit/RefundDeposit/CompleteWithdraw.

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

Followers MUST independently verify each operation before signing:

- **CreditBalance**: Verify `message_hash == keccak256(abi.encode(chainId, visionAddress, "creditBalance", user, amount, depositId))`. Optionally check the deposit event exists on settlement chain.
- **CompleteDeposit**: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "completeVisionDeposit", orderId))`. Check `depositProcessed[orderId]` is true on L3.
- **RefundDeposit**: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "refundVisionDeposit", orderId))`. Check deposit is stuck (age > timeout).
- **CompleteWithdraw**: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "completeVisionWithdraw", withdrawId, user, amount))`.

The `chain_id`, `vision_address`, and `custody_address` used for hash verification come from the follower's own config, not the proposal — this prevents a malicious leader from forging operations.

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
- On subsequent visits: `poll_result()`. If `Success` → advance state. If `Failed` → log, clear result, will re-enqueue next loop. If `Pending` → skip (wait for consensus cycle).

**Remove**: `get_reference_nonce()` — the consensus task reads the nonce, not the deposit watcher.

**Keep**: `drip_gas_if_needed()` — the gas drip is a plain native transfer (not BLS-verified), so the deposit watcher continues to call it locally after seeing a successful `CreditBalance` result via `poll_result()`.

**Security note**: The `message_hash` in the queue is computed by the local deposit watcher but the security boundary is the follower's independent recomputation from op params + own config. The queued hash is a hint for the leader's convenience.

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

### Error Handling

- **Timeout**: If no threshold reached within `sign_timeout_ms` (default 5000ms from config), write `OpResult::Failed` with timeout message
- **Partial signatures**: If some followers don't respond but threshold is reached, proceed with available signatures
- **On-chain revert**: After submitting, if tx reverts, write `OpResult::Failed`. The deposit watcher will re-enqueue on next loop.
- **Leader rotation**: If the leader changes mid-cycle, pending ops stay in the queue and the new leader picks them up next cycle. At most 1 second delay.

### Migration Path for Stuck Orders 26 & 27

**Pre-deploy check**: Verify actual DB state for orders 26/27. The current code optimistically advances to `CreditedOnL3` before confirming the tx receipt (lines 511-520). If the DB shows `CreditedOnL3` but `depositProcessed[orderId]` is false on L3, reset the DB state to `Pending` before restarting.

After deploying the fix:
1. Issuers restart, deposit watcher reloads pending deposits from DB
2. Orders 26 & 27 should be in `Pending` state (verified/reset above)
3. Deposit watcher enqueues `CreditBalance` for both
4. Vision ops task picks them up, collects 2/3 signatures, submits
5. If `AlreadyProcessed` revert → deposit was already credited somehow → advance state
6. If `BelowThreshold` still → configuration issue, check logs
7. Auto-refund logic stays as fallback: if deposits are stuck > 2 hours after the fix, they get refunded through the consensus path

### What This Doesn't Change

- Vision tick consensus (`engine.rs`) — already has its own multi-issuer flow via `TickConsensus`
- Balance proofs — single-issuer is correct (each issuer generates its own proof for its own API)
- Price consensus — untouched
- ITP/bridge consensus — untouched

## Testing

1. **Unit test**: `PendingOpsQueue` enqueue/drain/dedup/result lifecycle
2. **Integration test**: Mock 3-issuer consensus with deposit op → verify aggregated signature meets threshold
3. **E2E**: Deposit flow on testnet — deposit USDC on settlement, verify `creditBalance` succeeds with 2/3 BLS sig, verify `completeVisionDeposit` succeeds

## Immediate Fix (deploy independently)

`testnet.sh`: Add `--vision-settlement-rpc-url` to issuer config. This fixes Bug 2 immediately and stops the `Invalid response from lastSnapshotNonce` infinite retry loops, even though Bug 1 (BelowThreshold) still prevents actual success.

## Files Changed (BLS consensus fix)

| File | Change |
|------|--------|
| `issuer/src/vision/pending_ops.rs` | **New** — PendingOpsQueue + VisionOp + OpResult |
| `issuer/src/vision/mod.rs` | Add `pub mod pending_ops;` |
| `issuer/src/vision/deposit_watcher.rs` | Remove BLS signing fields, add queue-based submission, keep gas drip |
| `issuer/src/consensus/protocol.rs` | Add 4 consensus phase methods (credit/complete/refund/withdraw) following bridge pattern |
| `issuer/src/consensus/messages.rs` | Add 8 new message types (4 proposal + 4 sign) |
| `issuer/src/consensus/handler_macros.rs` | Register new proposal/sign handlers |
| `issuer/src/main.rs` | Wire PendingOpsQueue, spawn vision ops task, fix settlement registry address |
| `testnet.sh` | Add `--vision-settlement-rpc-url` to issuer config |
