# Story 7.9: Wire BridgeOrchestrator into Issuer Main Loop (Arb→L3 Bridge Step)

Status: done

## Story

As an **issuer node**,
I want **the BridgeOrchestrator's Arb→L3 bridge consensus to be fully integrated into the main consensus loop**,
So that **cross-chain orders are automatically processed with BLS consensus when detected**.

## Scope Clarification

This story covers **only Step 2 of the 8-step cross-chain buy flow** per vital-test.md:
- Step 2: Bridge USDC from Arbitrum to L3 (this story)

Subsequent steps (submitOrder, confirmBatch, bridge L3→Arb, release to vault, confirmFills) are covered by Stories 7.3-7.6.

## Context

**What exists (Story 7.2):**
- `BridgeOrchestrator` with all methods: `propose_bridge_arb_to_l3()`, `validate_bridge_proposal()`, `sign_bridge_proposal()`, `start_signature_collection()`, `add_follower_signature()`, `execute_bridge_arb_to_l3()`
- P2P message types: `BridgeArbToL3Proposal`, `BridgeArbToL3Sign` in `common/src/types/p2p.rs`
- Message routing: `ProcessBridgeArbToL3Proposal`, `ProcessBridgeArbToL3Sign` in `consensus/messages.rs`

**What's missing (this story):**
- Handlers at `protocol.rs:770-810` are **stubs that discard data** (`let _ = ...`)
- No `run_bridge_phase()` method in ConsensusProtocol (like `run_itp_creation_phase()`)
- Leader doesn't broadcast proposals via P2P
- Followers don't validate/sign/respond
- Existing TODO at `main.rs:1912-1923` documents intent but lacks implementation

**Key existing code references:**
- Existing handler stubs: `protocol.rs:770-810` (discard data with `let _ = ...`)
- ITP creation pattern to follow: `protocol.rs:1343-1600` (`run_itp_creation_phase`, `run_itp_creation_as_leader`, `collect_itp_creation_signatures`)
- BridgeConfig **runtime** values in main.rs:1465-1466: `sign_timeout_ms: 10000` (10 seconds, same as ITP creation)
- Existing TODO: `main.rs:1912-1923`

## Architectural Decision

**Follow ITP creation pattern exactly:**

ITP creation uses:
- `run_itp_creation_phase(&self, request, config, am_leader)` in ConsensusProtocol
- Leader: `run_itp_creation_as_leader()` → create ITP → broadcast → `collect_itp_creation_signatures()` polling loop
- Follower: `handle_itp_creation_proposal()` validates, signs, sends back
- Uses `self.aggregator` (protocol's SignatureAggregator) for collecting

Bridge should use:
- `run_bridge_arb_to_l3_phase(&self, order, am_leader)` in ConsensusProtocol
- Leader: create proposal → broadcast → poll orchestrator's SignatureCollector
- Follower: validate via orchestrator, sign, send back
- Uses BridgeOrchestrator's SignatureCollector (not protocol's aggregator) since it tracks per-order state

**Key difference:** Bridge needs orchestrator's collector (not protocol's aggregator) because:
- Multiple orders can be in flight
- Order-specific state (status, processed_orders)
- Different from ITP creation's single-request-at-a-time model

## Acceptance Criteria

1. **Given** a `CrossChainOrder` is detected by the leader node
   **When** `protocol.run_bridge_arb_to_l3_phase()` is called
   **Then** the leader creates a `BridgeProposal` and broadcasts `BridgeArbToL3Proposal` via P2P

2. **Given** a `BridgeArbToL3Proposal` is received by a follower
   **When** `ConsensusProtocol.handle_message()` routes to handler
   **Then** the follower:
   - Verifies leader's BLS signature using `key_registry.get_public_key()`
   - Validates proposal via `orchestrator.validate_bridge_proposal()`
   - Signs via `orchestrator.sign_bridge_proposal()` (which verifies message_hash)
   - Sends `BridgeArbToL3Sign` back to leader via `p2p.send_to()`

3. **Given** the leader receives `BridgeArbToL3Sign` messages from followers
   **When** handling in `ConsensusProtocol`
   **Then** signatures are added via `orchestrator.add_follower_signature()` which returns `Some(BridgeResult)` when threshold reached

4. **Given** `add_follower_signature()` returns `Some(BridgeResult)` (threshold reached)
   **When** leader's polling loop in `run_bridge_arb_to_l3_phase()` detects this
   **Then** leader calls `orchestrator.execute_bridge_arb_to_l3()` (note: aggregated sig unused in local E2E per design)

5. **Given** signature collection reaches timeout (`sign_timeout_ms: 10000` = 10s)
   **When** threshold not reached
   **Then** order remains with status `Pending`, warning logged, retry in next cycle

6. **Given** same order is detected in multiple cycles
   **When** leader checks before proposing
   **Then** skip if `orchestrator.is_order_processed()` returns true (replay protection)

## Tasks / Subtasks

### Task 1: Add BridgeOrchestrator reference to ConsensusProtocol
- [x] 1.1: Add field `bridge_orchestrator: RwLock<Option<Arc<RwLock<BridgeOrchestrator>>>>` to `ConsensusProtocol` struct in `protocol.rs`
- [x] 1.2: Initialize to `RwLock::new(None)` in constructor
- [x] 1.3: Add `set_bridge_orchestrator(&self, orch: Arc<RwLock<BridgeOrchestrator>>)` setter method
- [x] 1.4: Add imports: `use crate::bridge::{BridgeOrchestrator, BridgeProposal, BridgeResult, build_bridge_arb_to_l3_hash}` (verify export in `bridge/mod.rs:21`)

### Task 2: Add `run_bridge_arb_to_l3_phase()` to ConsensusProtocol (AC: #1, #4)
**Pattern:** Follow `run_itp_creation_phase()` at `protocol.rs:1343-1368`

- [x] 2.1: Add public method `run_bridge_arb_to_l3_phase(&self, order: &CrossChainOrder, am_leader: bool) -> Result<BridgeResult, BridgeError>`
- [x] 2.2: Branch: if `am_leader` call `run_bridge_arb_to_l3_as_leader()`, else call `run_bridge_arb_to_l3_as_follower()` (follower just waits, handled via message handler)
- [x] 2.3: In leader flow:
  - Check `orchestrator.is_order_processed()` first
  - Call `orchestrator.propose_bridge_arb_to_l3(&order)` to get `BridgeProposal`
  - Call `orchestrator.start_signature_collection(order_id, leader_sig)`
  - Broadcast `BridgeArbToL3Proposal` via `self.p2p.broadcast()`
  - Call `collect_bridge_signatures(order_id, timeout_ms, min_sigs)` polling loop
  - On success, call `orchestrator.execute_bridge_arb_to_l3(&proposal, &result)`
  - Return `BridgeResult`

### Task 3: Add `collect_bridge_signatures()` polling method (AC: #4)
**Pattern:** Follow `collect_itp_creation_signatures()` at `protocol.rs:1490-1600`

- [x] 3.1: Add private method `collect_bridge_signatures(&self, order_id: U256, timeout_ms: u64, min_signatures: usize) -> Result<BridgeResult, BridgeError>`
- [x] 3.2: Loop with timeout checking `orchestrator.check_threshold_reached(&order_id)`
- [x] 3.3: Sleep 50ms between polls (same as ITP creation)
- [x] 3.4: Return `BridgeResult` when threshold reached, or timeout error

### Task 4: Add `check_threshold_reached()` to BridgeOrchestrator (needed for Task 3)
**Note:** `add_follower_signature()` returns result when threshold reached, but polling loop needs to check independently.

- [x] 4.1: Add public method `check_threshold_reached(&self, order_id: &U256) -> Option<BridgeResult>`
- [x] 4.2: Look up `pending_signatures` for order_id
- [x] 4.3: If `collector.has_threshold(min_signatures)`, aggregate and return `Some(BridgeResult)`
- [x] 4.4: Else return `None`

### Task 5: Implement follower proposal handler (AC: #2)
**Location:** Replace stub at `protocol.rs:770-794`
**Pattern:** Follow `handle_itp_creation_proposal()` at `protocol.rs:1602-1723`

- [x] 5.1: Get `bridge_orchestrator` reference from field, return early if `None`
- [x] 5.2: Get leader's public key via `self.key_registry.get_public_key(&from)`
- [x] 5.3: Rebuild message_hash using `build_bridge_arb_to_l3_hash(config.arbitrum_chain_id, order_id, itp_id, user, amount, deadline)`
- [x] 5.4: Verify leader's BLS signature using `self.bls_signer.verify(&leader_pubkey, message_hash.as_bytes(), &leader_signature)`
- [x] 5.5: Reconstruct `BridgeProposal` struct from message fields
- [x] 5.6: Call `orchestrator.validate_bridge_proposal(&proposal).await` (validates against on-chain data)
- [x] 5.7: If valid, call `orchestrator.sign_bridge_proposal(&proposal)` (verifies message_hash internally)
- [x] 5.8: Send `P2PMessage::BridgeArbToL3Sign` back to leader via `self.p2p.send_to(from, message).await`
- [x] 5.9: Add structured logging for each step

### Task 6: Implement leader signature collection handler (AC: #3)
**Location:** Replace stub at `protocol.rs:795-810`

- [x] 6.1: Get `bridge_orchestrator` reference (write lock since we're modifying)
- [x] 6.2: Call `orchestrator.add_follower_signature(order_id, signer_index, signature).await`
- [x] 6.3: Log result (threshold reached or signature count)
- [x] 6.4: Note: The polling loop in `collect_bridge_signatures()` will detect threshold via `check_threshold_reached()`

### Task 7: Wire up in main.rs (AC: #1)

- [x] 7.1: After creating `consensus_protocol` and `bridge_orchestrator`, call `protocol.set_bridge_orchestrator(Arc::clone(&bridge_orchestrator)).await`
- [x] 7.2: In cross-chain order processing block, replace TODO with call to `protocol.run_bridge_arb_to_l3_phase(&order, am_leader).await`
- [x] 7.3: Handle result: log success, update order status

### Task 8: Handle timeout and retry (AC: #5)

- [x] 8.1: In `collect_bridge_signatures()`, on timeout return `Err(BridgeError::SigningTimeout)`
- [x] 8.2: In `run_bridge_arb_to_l3_phase()`, handle error by logging warning
- [x] 8.3: Order keeps status `Pending` - will be detected again next cycle
- [x] 8.4: ArbitrumChainReader's `seen_orders` clears periodically (line 1158), allowing retry

## Technical Notes

### Signal Flow (Leader to Polling Loop)
1. Leader calls `run_bridge_arb_to_l3_phase()` in ConsensusProtocol
2. Leader broadcasts proposal
3. Follower signatures arrive via P2P → `handle_message()` → `add_follower_signature()`
4. Leader's `collect_bridge_signatures()` loop calls `orchestrator.check_threshold_reached()`
5. When `Some(BridgeResult)`, loop exits and execution proceeds

### Why orchestrator reference needed (not just config)
Unlike ITP creation which stores `ItpCreationConfig` only, bridge consensus requires:
- `SignatureCollector` state in `pending_signatures` map (per-order)
- `order_status` tracking
- `processed_orders` for replay protection
These are in `BridgeOrchestrator`, not a config struct.

### Message Hash Verification
`sign_bridge_proposal()` at `orchestrator.rs:341-361` independently rebuilds and verifies the message hash before signing. This prevents tampering (follower doesn't trust leader's message_hash field).

### Local E2E Note
`execute_bridge_arb_to_l3()` ignores the aggregated signature (`_aggregated` param) for local E2E - it directly mints L3Usdc. Production would use aggregated sig for on-chain verification.

### Deduplication Strategy
1. **Event level:** `ArbitrumChainReader.seen_orders` prevents same event being fetched twice (clears periodically)
2. **Proposal level:** `orchestrator.is_order_processed()` before proposing
3. **Execution level:** `processed_orders` map prevents double execution

### Key Files

| File | Changes |
|------|---------|
| `issuer/src/consensus/protocol.rs` | Add bridge_orchestrator field, `run_bridge_arb_to_l3_phase()`, `collect_bridge_signatures()`, replace stubs at 770-810 |
| `issuer/src/bridge/orchestrator.rs` | Add `check_threshold_reached()` method |
| `issuer/src/main.rs` | Wire up orchestrator (~1555), call `run_bridge_arb_to_l3_phase()` instead of TODO |

## Dependencies

- Story 7.1: CrossChainOrder event handler (done)
- Story 7.2: BridgeOrchestrator module (done)
- Story 6.24: ITP creation consensus pattern (done - template)

## Dev Agent Record

### Implementation Plan
- Followed the ITP creation consensus pattern (`run_itp_creation_phase()`) to implement bridge consensus
- Added `bridge_orchestrator` field to ConsensusProtocol to hold reference to BridgeOrchestrator
- Implemented full leader flow: propose → broadcast → collect signatures → execute
- Implemented follower flow: receive proposal → verify leader sig → validate → sign → send back
- Polling-based signature collection using `check_threshold_reached()` method

### Debug Log
- Session 20260203-1241: Initial implementation
- Build succeeded with warnings only (unused variables, imports)
- 86 bridge tests passing, 53 consensus tests passing

### Completion Notes
All 8 tasks completed:
1. **Task 1:** Added `bridge_orchestrator: RwLock<Option<Arc<RwLock<BridgeOrchestrator>>>>` field and `set_bridge_orchestrator()` setter
2. **Task 2:** Implemented `run_bridge_arb_to_l3_phase()`, `run_bridge_arb_to_l3_as_leader()`, `run_bridge_arb_to_l3_as_follower()`
3. **Task 3:** Implemented `collect_bridge_signatures()` polling loop with 50ms sleep interval
4. **Task 4:** Added `check_threshold_reached()` to BridgeOrchestrator for polling support
5. **Task 5:** Implemented `handle_bridge_arb_to_l3_proposal()` - follower validates and signs
6. **Task 6:** Implemented `handle_bridge_arb_to_l3_sign()` - leader collects signatures
7. **Task 7:** Wired up in main.rs - set orchestrator on protocol, replaced TODO with `run_bridge_arb_to_l3_phase()` call
8. **Task 8:** Timeout returns `BridgeError::SigningTimeout`, order stays Pending for retry

## File List

| File | Status | Description |
|------|--------|-------------|
| `issuer/src/consensus/protocol.rs` | Modified | Added bridge_orchestrator field, 4 new methods for bridge consensus, fixed signature verification |
| `issuer/src/bridge/orchestrator.rs` | Modified | Added `check_threshold_reached()` and `get_signature_count()` methods |
| `issuer/src/main.rs` | Modified | Wire up orchestrator (sync await), replace TODO with consensus call, removed redundant replay check |

## Senior Developer Review (AI)

**Reviewed:** 2026-02-03
**Outcome:** Changes Requested → Fixed

### Issues Found and Fixed

**HIGH SEVERITY (Fixed):**
1. **Race condition in set_bridge_orchestrator** - Used `tokio::spawn()` which could cause race where `run_bridge_arb_to_l3_phase()` called before orchestrator set. Fixed: await directly instead of spawn.
2. **Wrong error type for already-processed orders** - Returned `BridgeError::OrderNotFound` for already-processed orders. Fixed: Changed to `BridgeError::AlreadyProcessed`.
3. **Timeout diagnostics lost signature count** - Returned `received: 0` on timeout. Fixed: Added `get_signature_count()` method and query actual count before timeout error.

**MEDIUM SEVERITY (Fixed):**
1. **Inconsistent signature verification** - Used `verify()` instead of `verify_message_hash()` for pre-hashed messages. Fixed: Changed to `verify_message_hash()` matching ITP creation pattern.
2. **Redundant replay protection** - Checked `is_order_processed()` in both main.rs and protocol.rs. Fixed: Removed redundant check from main.rs.
3. **Missing error code in logging** - Added `code = "INFRA-007"` to missing orchestrator warning.

**LOW SEVERITY (Noted):**
- Compiler warnings in issuer crate (unused variables/imports) - pre-existing, not from this story

### Verification
- Build succeeded with warnings only (same as pre-review)
- All changes are syntactically valid and follow existing patterns

## Change Log

- 2026-02-03: Story 7.9 implementation complete - BridgeOrchestrator wired into main loop
- 2026-02-03: Senior Developer Review - Fixed 3 HIGH, 3 MEDIUM issues
