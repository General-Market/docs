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

## Design: Piggyback on Consensus Cycle (Approach C)

### Architecture

```
┌─────────────────────┐     enqueue()      ┌──────────────────────┐
│  VisionDepositWatcher│───────────────────>│   PendingOpsQueue    │
│  (per-issuer task)   │<──────────────────│   (Arc<Mutex<...>>)  │
│                      │   poll_result()    │                      │
└─────────────────────┘                    └──────────┬───────────┘
                                                      │ drain per cycle
                                                      ▼
                                           ┌──────────────────────┐
                                           │   Main Consensus     │
                                           │   Cycle (1s loop)    │
                                           │                      │
                                           │  Leader:             │
                                           │   1. Drain queue     │
                                           │   2. Broadcast ops   │
                                           │   3. Collect sigs    │
                                           │   4. Aggregate BLS   │
                                           │   5. Submit on-chain │
                                           │   6. Write result    │
                                           │                      │
                                           │  Follower:           │
                                           │   1. Receive ops     │
                                           │   2. Validate        │
                                           │   3. Sign + return   │
                                           └──────────────────────┘
```

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

### Component 2: Consensus Protocol Extension

**File**: `issuer/src/consensus/protocol.rs`

Add a new signing round type alongside the existing price/batch/ITP/bridge rounds.

#### New P2P Messages

```rust
// Leader → Followers
VisionOpsProposal {
    cycle: u64,
    ops: Vec<VisionOp>,  // batch of operations to sign
    leader_signatures: Vec<(usize, Vec<u8>)>,  // leader's BLS sig per op
}

// Follower → Leader
VisionOpsSign {
    cycle: u64,
    signatures: Vec<(usize, Vec<u8>)>,  // follower's BLS sig per op (index matches proposal)
    signer_index: u8,
}
```

#### Leader Flow (per cycle, after price consensus)

1. `drain_pending()` from `PendingOpsQueue`
2. If empty, skip
3. For each op: sign the `message_hash` with own BLS keypair
4. Broadcast `VisionOpsProposal` to all peers
5. Collect `VisionOpsSign` from followers (reuse `SignatureAggregator` pattern, one per op)
6. When threshold reached for an op: aggregate signatures, compute `signers_bitmask`
7. Submit on-chain tx (creditBalance/completeDeposit/refundDeposit/completeWithdraw)
8. Write `OpResult::Success` or `OpResult::Failed` to queue

#### Follower Flow

1. Receive `VisionOpsProposal`
2. For each op: validate (check the message hash matches expected computation from op params)
3. Sign each validated op with own BLS keypair
4. Send `VisionOpsSign` back to leader

#### Validation (Follower)

Followers MUST independently verify each operation before signing:

- **CreditBalance**: Verify `message_hash == keccak256(abi.encode(chainId, visionAddress, "creditBalance", user, amount, depositId))`. Optionally check the deposit event exists on settlement chain.
- **CompleteDeposit**: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "completeVisionDeposit", orderId))`. Check `depositProcessed[orderId]` is true on L3.
- **RefundDeposit**: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "refundVisionDeposit", orderId))`. Check deposit is stuck (age > timeout).
- **CompleteWithdraw**: Verify `message_hash == keccak256(abi.encode(chainId, custodyAddress, "completeVisionWithdraw", withdrawId, user, amount))`.

The `chain_id`, `vision_address`, and `custody_address` used for hash verification come from the follower's own config, not the proposal — this prevents a malicious leader from forging operations.

### Component 3: Deposit Watcher Changes

**File**: `issuer/src/vision/deposit_watcher.rs`

**Remove**: `bls_keypair`, `bls_signer`, `node_index`, `l3_chain_writer`, `settlement_chain_writer` fields. The deposit watcher no longer signs or submits transactions.

**Add**: `ops_queue: Arc<PendingOpsQueue>` field.

**Change the signing methods**:
- `sign_and_submit_credit_balance()` → `request_credit_balance()`: compute message hash, `enqueue(CreditBalance { ... })`, return immediately
- `sign_and_submit_complete_deposit()` → `request_complete_deposit()`: same pattern
- `sign_and_submit_refund_deposit()` → `request_refund_deposit()`: same pattern
- `sign_and_submit_complete_withdraw()` → `request_complete_withdraw()`: same pattern

**Change the state machine** (`process_pending_deposits`, `process_pending_withdrawals`):
- On first visit to an actionable state: enqueue the op
- On subsequent visits: `poll_result()`. If `Success` → advance state. If `Failed` → log, clear result, will re-enqueue next loop. If `Pending` → skip (wait for consensus cycle).

**Remove**: `get_reference_nonce()` — the consensus cycle reads the nonce, not the deposit watcher.

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
3. Pass `Arc::clone(&ops_queue)` to the consensus protocol (or the main loop where vision ops are processed)
4. In the main consensus cycle (after price update, before settlement tasks): drain queue, run vision ops signing round if any ops present

### Error Handling

- **Timeout**: If no threshold reached within `sign_timeout_ms` (default 5000ms from config), write `OpResult::Failed` with timeout message
- **Partial signatures**: If some followers don't respond but threshold is reached, proceed with available signatures
- **On-chain revert**: After submitting, if tx reverts, write `OpResult::Failed`. The deposit watcher will re-enqueue on next loop.
- **Leader rotation**: If the leader changes mid-cycle, pending ops stay in the queue and the new leader picks them up next cycle. At most 1 second delay.

### Migration Path for Stuck Orders 26 & 27

After deploying the fix:
1. Issuers restart, deposit watcher reloads pending deposits from DB
2. Orders 26 & 27 are still in `Pending` state (never successfully credited)
3. Deposit watcher enqueues `CreditBalance` for both
4. Consensus cycle picks them up, collects 2/3 signatures, submits
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

## Files Changed

| File | Change |
|------|--------|
| `issuer/src/vision/pending_ops.rs` | **New** — PendingOpsQueue + VisionOp + OpResult |
| `issuer/src/vision/mod.rs` | Add `pub mod pending_ops;` |
| `issuer/src/vision/deposit_watcher.rs` | Remove BLS signing, add queue-based submission |
| `issuer/src/consensus/protocol.rs` | Add VisionOpsProposal/Sign handling + signing round |
| `issuer/src/consensus/messages.rs` | Add VisionOpsProposal/VisionOpsSign message types |
| `issuer/src/main.rs` | Wire PendingOpsQueue, fix settlement registry address |
| `testnet.sh` | Add `--vision-settlement-rpc-url` to issuer config |
