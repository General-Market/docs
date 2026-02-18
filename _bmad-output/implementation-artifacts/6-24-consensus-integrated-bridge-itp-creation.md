# Story 6.24: Consensus-Integrated Bridge ITP Creation

## Status

**Status:** done
**Created:** 2026-02-01
**Updated:** 2026-02-01
**Wave:** 11
**Depends:** [6-16, 6-21]

---

## Story

As a **user creating an ITP from the frontend**,
I want **ITP creation to go through BLS issuer consensus (11/20 threshold, 2/3 when <20 nodes)**,
So that **no single issuer can unilaterally create ITPs and the system maintains decentralized security**.

## Background

**Current Problem:**
- `issuer/src/bridge/watcher.rs` runs only on node 1 (`main.rs:1433`)
- Single issuer creates ITP directly, bypassing consensus entirely
- Watcher uses wrong contract signature: `completeCreateItp(address, uint256, address)` - NO BLS signature
- Defeats the purpose of multi-issuer BLS architecture

**What Already Exists (from Story 6-21):**
- `ArbitrumChainReader` with `get_all_pending_requests()` - STATELESS pattern ✅
- `ArbitrumChainWriter` with `complete_create_itp(nonce, orbit_itp_id, bls_signature)` ✅
- `consensus/itp_creation.rs` with `build_message_hash()` (136 bytes, includes orbit_itp_id) ✅
- `consensus/protocol.rs` with `run_itp_creation_phase()` method ✅
- P2P message types: `ItpCreationProposal`, `ItpCreationSign` ✅

**What This Story Does:**
- DELETE the legacy single-watcher module
- WIRE existing consensus components into `main.rs`
- REPLACE `simulate_l3_itp_creation()` stub with real L3 call
- ENABLE all nodes to poll Arbitrum (not just node 1)

---

## Architecture

```
Frontend → BridgeProxy.requestCreateItp() → CreateItpRequested event (Arbitrum)
                                                    ↓
                    ┌───────────────────────────────┼───────────────────────────────┐
                    ↓                               ↓                               ↓
              Issuer 1                        Issuer 2                        Issuer 3
         (ArbitrumChainReader)           (ArbitrumChainReader)           (ArbitrumChainReader)
                    │                               │                               │
                    └───────────────────────────────┼───────────────────────────────┘
                                                    ↓
                              Leader: Index.createITP() on L3 → gets orbit_itp_id
                                                    ↓
                              Leader broadcasts ITP_CREATION_PROPOSAL (with orbit_itp_id)
                                                    ↓
                              Followers validate & sign → ITP_CREATION_SIGN
                                                    ↓
                              Leader aggregates (11/20 or 2/3 threshold)
                                                    ↓
                              Leader: BridgeProxy.completeCreateItp(nonce, orbit_itp_id, blsSig)
```

---

## Acceptance Criteria

### AC1: Remove Single-Watcher Module
**Given** the current `issuer/src/bridge/` module exists
**When** this story is complete
**Then** the module is deleted and bridge watcher spawn logic is removed from `main.rs:1430-1460`

### AC2: All Issuers Poll Arbitrum
**Given** 3 issuer nodes running with `--bridge-proxy <address>` flag
**When** `CreateItpRequested` event is emitted on BridgeProxy (Arbitrum)
**Then** all 3 issuers detect the event via `ArbitrumChainReader.get_all_pending_requests()`

### AC3: ITP Creation Uses Existing Consensus
**Given** pending ITP creation requests detected
**When** `run_itp_creation_phase()` is called after main consensus cycle
**Then** leader creates ITP on L3, broadcasts proposal, collects signatures
**And** followers validate and sign via existing `handle_itp_creation_proposal()`

### AC4: Leader Creates Real L3 ITP
**Given** leader has pending ITP creation request
**When** consensus begins
**Then** leader calls `EthersChainWriter.create_itp()` on L3 (NOT `simulate_l3_itp_creation`)
**And** receives real `orbit_itp_id` from transaction receipt

### AC5: Leader Submits with BLS Signature
**Given** leader has aggregated 11+ signatures (or 2/3 of active nodes)
**When** threshold is met
**Then** leader calls `ArbitrumChainWriter.complete_create_itp(nonce, orbit_itp_id, bls_signature)`
**And** BridgedITP is deployed on Arbitrum

### AC6: Stateless Design Preserved
**Given** an issuer restarts mid-consensus
**When** issuer rejoins
**Then** it queries fresh state via `ArbitrumChainReader.get_all_pending_requests()`
**And** pending requests that weren't completed are retried next cycle

---

## Technical Design

### Existing Components (DO NOT RECREATE)

| Component | Location | Status |
|-----------|----------|--------|
| `ArbitrumChainReader` | `issuer/src/chain/arbitrum_reader.rs` | ✅ Complete |
| `ArbitrumChainWriter` | `issuer/src/chain/arbitrum_writer.rs` | ✅ Complete |
| `build_message_hash()` | `issuer/src/consensus/itp_creation.rs:49-98` | ✅ Correct (136 bytes) |
| `run_itp_creation_phase()` | `issuer/src/consensus/protocol.rs:1028-1142` | ✅ Partial (needs wiring) |
| `handle_itp_creation_proposal()` | `issuer/src/consensus/protocol.rs:1253-1363` | ✅ Complete |
| `ItpCreationProposal` | `common/src/types/p2p.rs:92-109` | ✅ Complete |
| `ItpCreationSign` | `common/src/types/p2p.rs:114-119` | ✅ Complete |
| `ItpCreationRequest` | `issuer/src/chain/events/itp_creation.rs:41-58` | ✅ Complete |

### Files to Delete

| File | Reason |
|------|--------|
| `issuer/src/bridge/mod.rs` | Legacy single-watcher module |
| `issuer/src/bridge/watcher.rs` | Bypasses consensus, wrong contract signature |

### Files to Modify

| File | Changes |
|------|---------|
| `issuer/src/lib.rs` | Remove `pub mod bridge;` |
| `issuer/src/main.rs` | Remove watcher spawn (lines 1430-1460), add ArbitrumChainReader/Writer init for all nodes, call `run_itp_creation_phase()` |
| `issuer/src/consensus/protocol.rs` | Replace `simulate_l3_itp_creation()` with real `create_itp()` call |

### Key Incompatibility: Watcher vs Real Contract

**Legacy watcher (`watcher.rs:393`):**
```rust
// WRONG - no BLS signature!
completeCreateItp(address admin, uint256 nonce, address orbitItp)
```

**Real contract (`ArbitrumChainWriter`):**
```rust
// CORRECT - includes BLS signature
completeCreateItp(uint256 nonce, bytes32 orbitItpId, bytes blsSignature)
```

### Message Hash (Already Correct in Codebase)

Reference: `issuer/src/consensus/itp_creation.rs:49-98`

```rust
// abi.encodePacked layout (136 bytes total):
// - chain_id: 32 bytes (uint256, big endian)
// - bridge_proxy: 20 bytes (address, packed)
// - admin: 20 bytes (address, packed)
// - nonce: 32 bytes (uint256, big endian)
// - orbit_itp_id: 32 bytes (bytes32)
```

This matches `BridgeProxy.sol:203-209` exactly.

### Threshold Configuration

Reference: `issuer/src/consensus/itp_creation.rs:135-144`

```rust
impl Default for ItpCreationConfig {
    fn default() -> Self {
        Self {
            arbitrum_chain_id: 42161,
            bridge_proxy_address: Address::zero(),
            proposal_timeout_ms: 500,
            sign_timeout_ms: 300,
            min_signatures: 11,  // Production: 11/20
        }
    }
}
```

For E2E testing with 3 nodes, set `min_signatures: 2` via config.

---

## Tasks

### Task 1: Delete Legacy Bridge Module
- [x] 1.1: Delete `issuer/src/bridge/mod.rs`
- [x] 1.2: Delete `issuer/src/bridge/watcher.rs`
- [x] 1.3: Remove `pub mod bridge;` from `issuer/src/lib.rs`
- [x] 1.4: Remove bridge watcher spawn logic from `issuer/src/main.rs:1430-1460`
- [x] 1.5: Remove `bridge_watcher_handle` variable and cleanup code

### Task 2: Initialize ArbitrumChainReader in main.rs
- [x] 2.1: Add `ArbitrumChainReaderConfig` initialization using `--bridge-proxy` flag
- [x] 2.2: Create `ArbitrumChainReader` instance for ALL nodes (not just node 1)
- [x] 2.3: Pass reader to consensus protocol or cycle manager
- [x] 2.4: Use config fields: `arbitrum_rpc_url`, `bridge_proxy_address` (already in `config.rs:140-143`)

### Task 3: Initialize ArbitrumChainWriter in main.rs
- [x] 3.1: Add `ArbitrumChainWriterConfig` initialization
- [x] 3.2: Create `ArbitrumChainWriter` instance using private key
- [x] 3.3: Pass writer to consensus protocol for `complete_create_itp()` calls

### Task 4: Wire ITP Creation Phase to Consensus Loop
- [x] 4.1: Call `run_itp_creation_phase()` after main consensus cycle in `main.rs`
- [x] 4.2: Pass `ItpCreationConfig` with correct `bridge_proxy_address`
- [x] 4.3: Query pending requests via `ArbitrumChainReader.get_all_pending_requests()`
- [x] 4.4: For each pending request, call existing `run_itp_creation_phase()`

### Task 5: Replace simulate_l3_itp_creation() with Real Call
- [x] 5.1: In `protocol.rs:1148-1167`, replace stub with `ChainWriter.create_itp()`
- [x] 5.2: Parse `ITPCreated` event from transaction receipt to get real `orbit_itp_id` (via EthersChainWriter impl)
- [x] 5.3: Handle transaction failure gracefully (log error, retry next cycle)

### Task 6: Wire ArbitrumChainWriter for Completion
- [x] 6.1: After signature aggregation in `run_itp_creation_as_leader()`, call `ArbitrumChainWriter.complete_create_itp()`
- [x] 6.2: Pass aggregated BLS signature from `ItpCreationResult`
- [x] 6.3: Wait for receipt confirmation before logging success

### Task 7: Update E2E Test Script
- [x] 7.1: Update `scripts/e2e-itp-creation.sh` to pass `--bridge-proxy` to all 3 nodes
- [x] 7.2: Remove any node 1 special handling
- [x] 7.3: Set `min_signatures: 2` for 2-of-3 threshold in E2E config (via `--signature-threshold 2`)
- [x] 7.4: Verify all nodes detect same event and reach consensus

---

## Test Scenarios

| Test | Description |
|------|-------------|
| `test_all_issuers_detect_event` | 3 nodes all see CreateItpRequested via ArbitrumChainReader |
| `test_consensus_itp_creation` | Leader creates L3 ITP, broadcasts, 2 followers sign, completion submitted |
| `test_insufficient_signatures` | Only 1 signature → no ITP created, request remains pending |
| `test_stateless_restart` | Node restart → picks up pending on next cycle via get_all_pending_requests() |
| `test_already_completed_skipped` | Completed request (isPending=false) not processed again |
| `test_real_l3_itp_creation` | Leader calls actual Index.createITP(), gets real orbit_itp_id |
| `test_bls_signature_submitted` | completeCreateItp receives valid aggregated BLS signature |

---

## Verified Code References

| Component | Location | Purpose |
|-----------|----------|---------|
| Legacy watcher spawn | `main.rs:1430-1460` | DELETE this block |
| Legacy watcher module | `bridge/watcher.rs` | DELETE entire file |
| ArbitrumChainReader | `chain/arbitrum_reader.rs:47-396` | Use `get_all_pending_requests()` |
| ArbitrumChainWriter | `chain/arbitrum_writer.rs:52-342` | Use `complete_create_itp()` |
| Message hash | `consensus/itp_creation.rs:49-98` | Already correct (136 bytes) |
| Consensus phase | `consensus/protocol.rs:1028-1142` | `run_itp_creation_phase()` exists |
| Follower handler | `consensus/protocol.rs:1253-1363` | `handle_itp_creation_proposal()` exists |
| L3 creation stub | `consensus/protocol.rs:1148-1167` | Replace `simulate_l3_itp_creation()` |
| P2P messages | `common/types/p2p.rs:92-119` | `ItpCreationProposal`, `ItpCreationSign` |
| Event types | `chain/events/itp_creation.rs:41-277` | `ItpCreationRequest` with validation |
| Config fields | `config.rs:140-143` | `arbitrum_rpc_url`, `bridge_proxy_address` |

---

## Notes

- This story WIRES existing components from Story 6-21, not reimplementing them
- Legacy watcher used wrong contract ABI - must be deleted entirely
- ArbitrumChainReader already implements stateless per-cycle pattern
- For E2E testing, set `min_signatures: 2` (2-of-3 threshold)
- Production uses `min_signatures: 11` (11/20 threshold)
- BridgedITP deployment happens automatically in `completeCreateItp()` on Arbitrum

---

## Dev Agent Record

### Implementation Plan
Wire existing consensus ITP creation components from Story 6-21 into main.rs, replacing the legacy single-watcher module that bypassed BLS consensus.

### Debug Log
- Session 20260201-1500: Deleted legacy bridge module, updated lib.rs exports
- Added `create_itp()` to ChainWriter trait for L3 ITP creation via consensus
- Replaced `simulate_l3_itp_creation()` with real `create_l3_itp()` using ChainWriter
- All 3 nodes now poll Arbitrum via ArbitrumChainReader.get_all_pending_requests()

### Completion Notes
- **AC1**: Legacy bridge module deleted (2 files removed, imports cleaned)
- **AC2**: All nodes initialize ArbitrumChainReader when `--bridge-proxy` is set
- **AC3**: ITP creation phase wired into consensus loop after main cycle
- **AC4**: `create_l3_itp()` calls `chain_writer.create_itp()` for real L3 creation
- **AC5**: Leader calls `arb_writer.complete_create_itp_and_wait()` with receipt confirmation
- **AC6**: Stateless design preserved - `get_all_pending_requests()` queries fresh state each cycle

---

## Senior Developer Review (AI)

**Reviewed:** 2026-02-01
**Result:** CHANGES APPLIED

### Issues Found & Fixed

**HIGH (4 fixed):**
1. **H1**: E2E script missing verification - Added health checks and initialization verification
2. **H2**: Hardcoded leader detection `node_index == 0` - Fixed to use proper leader election from last signature
3. **H3**: ItpCreationProposal not handled by P2P router - Added `itp_creation_config` to protocol and inline handling
4. **H4**: No receipt confirmation before logging success - Changed to use `complete_create_itp_and_wait()`

**MEDIUM (3 fixed):**
1. **M3**: Missing integration tests - Added `issuer/tests/itp_creation_consensus_test.rs` with 6 test cases
2. **M5**: Missing initialization status logging - Added summary log showing bridge ITP creation status

**LOW (1 fixed):**
1. **L1**: Stale script comment saying "Issuer 1 will watch" - Updated to clarify all nodes participate

---

## File List

### Deleted
- `issuer/src/bridge/mod.rs` - Legacy single-watcher module
- `issuer/src/bridge/watcher.rs` - Bypassed consensus, wrong contract ABI

### Modified
- `issuer/src/lib.rs` - Removed `pub mod bridge;`, added Arbitrum chain exports
- `issuer/src/main.rs` - Removed watcher spawn, added ArbitrumChainReader/Writer init, wired ITP creation phase, fixed leader election, added receipt confirmation
- `issuer/src/consensus/protocol.rs` - Replaced `simulate_l3_itp_creation()` with `create_l3_itp()`, added `itp_creation_config` field and `set_itp_creation_config()`, fixed ItpCreationProposal handling
- `common/src/traits/chain_writer.rs` - Added `create_itp()` method to trait
- `common/src/mocks/chain.rs` - Implemented `create_itp()` for MockChain
- `common/src/adapters/rpc_chain_writer.rs` - Added `create_itp()` (returns error - not supported)
- `common/tests/traits_test.rs` - Added `create_itp()` to test mock
- `issuer/src/chain/writer.rs` - Added `create_itp()` to ChainWriter trait impl
- `scripts/e2e-itp-creation.sh` - Updated to pass `--bridge-proxy` to all 3 nodes, added health verification

### Created
- `issuer/tests/itp_creation_consensus_test.rs` - Integration tests for ITP creation consensus

---

## Change Log

| Date | Change |
|------|--------|
| 2026-02-01 | Story implemented: Consensus-integrated bridge ITP creation wired into main.rs |
| 2026-02-01 | Code review: Fixed 4 HIGH, 3 MEDIUM, 1 LOW issues. Added integration tests. |
