# Issuer Code Simplification — Remove Duplicates

**Date**: 2026-02-28
**Goal**: Eliminate duplicated code patterns across the issuer codebase. Estimated 15-20% reduction in total LOC.

---

## Priority 1 — ABI Encoding Helpers (saves ~1,500 lines)

### Problem
The byte-packing pattern below appears **50+ times** across `bridge/types.rs`, `consensus/itp_creation.rs`, `consensus/rebalance_request.rs`, `api/nav_sign.rs`:

```rust
let mut bytes = [0u8; 32];
value.to_big_endian(&mut bytes);
data.extend_from_slice(&bytes);
```

Address padding (left-pad to 32 bytes) appears 50+ times:
```rust
let mut addr_bytes = [0u8; 32];
addr_bytes[12..32].copy_from_slice(address.as_bytes());
data.extend_from_slice(&addr_bytes);
```

### Fix
Create `src/abi.rs` with helpers:

```rust
pub struct AbiEncoder {
    data: Vec<u8>,
}

impl AbiEncoder {
    pub fn new() -> Self { Self { data: Vec::new() } }
    pub fn with_capacity(cap: usize) -> Self { Self { data: Vec::with_capacity(cap) } }
    pub fn u256(mut self, val: U256) -> Self { ... }
    pub fn address_padded(mut self, addr: Address) -> Self { ... }  // left-pad to 32
    pub fn address_packed(mut self, addr: Address) -> Self { ... }  // 20 bytes
    pub fn h256(mut self, val: H256) -> Self { ... }
    pub fn bytes(mut self, val: &[u8]) -> Self { ... }
    pub fn keccak256(&self) -> H256 { H256::from_slice(&ethers::utils::keccak256(&self.data)) }
    pub fn finish(self) -> Vec<u8> { self.data }
}
```

Then replace all hash builders, e.g.:
```rust
// BEFORE (8 lines)
let mut data = Vec::with_capacity(128);
let mut chain_bytes = [0u8; 32];
U256::from(chain_id).to_big_endian(&mut chain_bytes);
data.extend_from_slice(&chain_bytes);
let mut addr_bytes = [0u8; 32];
addr_bytes[12..32].copy_from_slice(contract.as_bytes());
data.extend_from_slice(&addr_bytes);
H256::from_slice(&ethers::utils::keccak256(&data))

// AFTER (1 line)
AbiEncoder::new().u256(chain_id.into()).address_padded(contract).keccak256()
```

### Files to touch
- Create: `src/abi.rs`
- Modify: `bridge/types.rs` (all `build_*_hash` and `build_*_calldata` functions)
- Modify: `consensus/itp_creation.rs` (`build_message_hash`, `compute_weights_hash`)
- Modify: `consensus/rebalance_request.rs` (`build_message_hash`, `compute_weights_hash`)
- Modify: `api/nav_sign.rs`

---

## Priority 2 — Unified Signature Result (saves ~300 lines)

### Problem
14+ result structs with identical fields:

```rust
pub struct BridgeResult { pub aggregated_signature: BLSSignature, pub signer_bitmap: U256, pub signature_count: usize }
pub struct SubmitOrderResult { pub aggregated_signature: BLSSignature, pub signer_bitmap: U256, pub signature_count: usize }
pub struct BatchResult { pub aggregated_signature: BLSSignature, pub signer_bitmap: U256, pub signature_count: usize }
// ... 11 more identical structs
```

### Fix
Single struct in `src/consensus/types.rs` (or `src/types.rs`):

```rust
pub struct SignedConsensusResult {
    pub aggregated_signature: BLSSignature,
    pub signer_bitmap: U256,
    pub signature_count: usize,
}
```

Replace all 14 result types with `SignedConsensusResult`. Update all usage sites.

### Files to touch
- Modify: `bridge/types.rs` (remove 14 result structs)
- Modify: `bridge/orchestrator.rs` (update return types)
- Modify: `consensus/protocol.rs` (update return types)

---

## Priority 3 — Deduplicate `compute_weights_hash` (saves 20 lines)

### Problem
Exact same function in two files:
- `consensus/itp_creation.rs:110-120`
- `consensus/rebalance_request.rs:89-99`

### Fix
Move to `src/abi.rs` (or a shared consensus util) as a single function. Both callers import from there.

---

## Priority 4 — Consolidate Error Variants (saves ~100 lines)

### Problem
`BridgeError` and `RebalanceRequestError` share identical variants:
```rust
InsufficientSignatures { got: usize, need: usize }
ProposalTimeout { timeout_ms: u64 }
SigningTimeout { received: usize, timeout_ms: u64 }
```

### Fix
Create shared `ConsensusError` enum with common variants. Module-specific errors wrap it:

```rust
pub enum ConsensusError {
    InsufficientSignatures { got: usize, need: usize },
    ProposalTimeout { timeout_ms: u64 },
    SigningTimeout { received: usize, timeout_ms: u64 },
}

pub enum BridgeError {
    Consensus(ConsensusError),
    // bridge-specific variants...
}
```

### Files to touch
- Create: shared error type (in `src/consensus/types.rs` or `src/errors.rs`)
- Modify: `bridge/types.rs`
- Modify: `consensus/rebalance_request.rs`

---

## Execution Order

1. **P1 — ABI helpers** → create `abi.rs`, then sweep all files replacing byte-packing
2. **P2 — Unified result** → replace 14 result structs
3. **P3 — Deduplicate weights hash** → move to shared location
4. **P4 — Error consolidation** → extract common error variants

Each step is independently compilable and testable. Commit after each.

---

## Out of Scope

- Refactoring consensus protocol state machine (too risky, different goal)
- Merging vision deposit watcher / chain listener (functional overlap, not code duplication)
- NAV calculation consolidation (`nav.rs` vs `backend_nav.rs` serve different purposes)
- Proposal struct generics (14 proposal types have genuinely different payloads)
