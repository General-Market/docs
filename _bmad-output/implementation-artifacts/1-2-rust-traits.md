# Story 1.2: Rust Traits

Status: done

## Story

As an **issuer/AP developer**,
I want **all Rust traits defined for Chain, Issuer, AP, BLS, and P2P interactions**,
So that **I can implement components against stable interfaces while other teams work in parallel**.

## Acceptance Criteria

1. **Given** a Rust workspace with `issuer/` and `ap/` crates
   **When** I create shared traits in `common/src/traits/`
   **Then** ChainReader trait defines: get_pending_orders, get_itp, get_prices, get_issuer_registry, subscribe_events

2. **And** ChainWriter trait defines: submit_batch, confirm_fills, submit_bridge

3. **And** BLSSigner trait defines: sign, aggregate_signatures, verify

4. **And** P2PTransport trait defines: broadcast, send_to, receive, connect_peers

5. **And** APClient trait defines: place_order, get_fills, get_order_status

6. **And** all traits compile with `cargo build`

## Tasks / Subtasks

- [x] Task 1: Create Rust workspace structure (AC: #1)
  - [x] 1.1 Initialize workspace Cargo.toml at project root with members: common, issuer, ap
  - [x] 1.2 Create `common/` crate with `src/lib.rs` and `src/traits/mod.rs`
  - [x] 1.3 Create placeholder `issuer/` and `ap/` crates
  - [x] 1.4 Verify workspace builds with `cargo build`

- [x] Task 2: Define shared types for traits (AC: #1-5)
  - [x] 2.1 Create `common/src/types/mod.rs` with core types
  - [x] 2.2 Define LimitOrder struct matching Solidity (id, user, pairId, side, amount, limitPrice, slippageTier, deadline, itpId, timestamp, status)
  - [x] 2.3 Define ITPCore struct (name, symbol, creator, created_at, fee_rate, status, total_supply, total_value, asset_count) - aligned with Solidity TypesLib.sol
  - [x] 2.4 Define Fill struct (orderId, fillPrice, fillAmount, txHash)
  - [x] 2.5 Define Price struct (price, timestamp, assetIndex)
  - [x] 2.6 Define Issuer struct (address, ip, blsPubkey, active)
  - [x] 2.7 Define enums: Side (Buy, Sell), OrderStatus (Pending, Filled)

- [x] Task 3: Implement ChainReader trait (AC: #1)
  - [x] 3.1 Create `common/src/traits/chain_reader.rs`
  - [x] 3.2 Define async trait with: get_pending_orders() -> Result<Vec<LimitOrder>>
  - [x] 3.3 Add: get_itp(itp_id: [u8; 32]) -> Result<ITPCore>
  - [x] 3.4 Add: get_prices() -> Result<Vec<Price>>
  - [x] 3.5 Add: get_issuer_registry() -> Result<Vec<Issuer>>
  - [x] 3.6 Add: subscribe_events(filter: EventFilter) -> Result<EventStream>
  - [x] 3.7 Define EventFilter and EventStream types

- [x] Task 4: Implement ChainWriter trait (AC: #2)
  - [x] 4.1 Create `common/src/traits/chain_writer.rs`
  - [x] 4.2 Define async trait with: submit_batch(cycle_number: u64, order_ids: Vec<u64>, bls_signature: Vec<u8>) -> Result<TxHash>
  - [x] 4.3 Add: confirm_fills(cycle_number: u64, fills: Vec<Fill>, bls_signature: Vec<u8>) -> Result<TxHash>
  - [x] 4.4 Add: submit_bridge(dest_chain_id: u64, amount: U256, bls_signature: Vec<u8>) -> Result<TxHash>

- [x] Task 5: Implement BLSSigner trait (AC: #3)
  - [x] 5.1 Create `common/src/traits/bls_signer.rs`
  - [x] 5.2 Define trait with: sign(private_key: &[u8], message: &[u8]) -> Result<BLSSignature>
  - [x] 5.3 Add: aggregate_signatures(signatures: Vec<BLSSignature>) -> Result<BLSSignature>
  - [x] 5.4 Add: verify(public_key: &BLSPublicKey, message: &[u8], signature: &BLSSignature) -> Result<bool>
  - [x] 5.5 Define BLSSignature and BLSPublicKey types (for BN254 curve)

- [x] Task 6: Implement P2PTransport trait (AC: #4)
  - [x] 6.1 Create `common/src/traits/p2p_transport.rs`
  - [x] 6.2 Define async trait with: connect_peers(peers: Vec<PeerInfo>) -> Result<()>
  - [x] 6.3 Add: broadcast(message: P2PMessage) -> Result<()>
  - [x] 6.4 Add: send_to(peer_id: PeerId, message: P2PMessage) -> Result<()>
  - [x] 6.5 Add: receive() -> Result<MessageStream>
  - [x] 6.6 Define P2PMessage enum with message types per architecture (CYCLE_START, PRICE_PROPOSAL, PRICE_VOTE, BATCH_PROPOSAL, BATCH_SIGN, HEARTBEAT, KICK_VOTE)
  - [x] 6.7 Define PeerInfo struct (peer_id, ip, port)

- [x] Task 7: Implement APClient trait (AC: #5)
  - [x] 7.1 Create `common/src/traits/ap_client.rs`
  - [x] 7.2 Define async trait with: place_order(pair: String, side: Side, amount: U256, price: U256) -> Result<OrderId>
  - [x] 7.3 Add: get_fills(order_id: OrderId) -> Result<Vec<Fill>>
  - [x] 7.4 Add: get_order_status(order_id: OrderId) -> Result<OrderStatus>

- [x] Task 8: Wire up module exports and verify compilation (AC: #6)
  - [x] 8.1 Export all traits from `common/src/traits/mod.rs`
  - [x] 8.2 Export all types from `common/src/types/mod.rs`
  - [x] 8.3 Re-export in `common/src/lib.rs`
  - [x] 8.4 Run `cargo build` and fix any compilation errors
  - [x] 8.5 Run `cargo clippy` and address warnings

## Dev Notes

### Architecture Patterns and Constraints

**Technology Stack:**
- Language: Rust (stable toolchain)
- Async runtime: tokio (recommended for async traits)
- Serialization: MessagePack for P2P messages (per architecture Section 4)
- BLS Curve: BN254 (must be compatible with Solidity precompile 0x06)
- Error handling: Use `thiserror` for custom error types

**P2P Message Types (from Architecture Section 4):**

| Message Type | Sender | Receiver | Timeout | Retry |
|--------------|--------|----------|---------|-------|
| `CYCLE_START` | Leader | All | - | - |
| `PRICE_PROPOSAL` | Leader | All | 200ms | 1 |
| `PRICE_VOTE` | All | Leader | 300ms | 0 |
| `BATCH_PROPOSAL` | Leader | All | 200ms | 1 |
| `BATCH_SIGN` | All | Leader | 300ms | 0 |
| `HEARTBEAT` | All | All | 1000ms | - |
| `KICK_VOTE` | Any | All | 500ms | 0 |

**Key Type Mappings (Solidity <-> Rust):**

| Solidity | Rust |
|----------|------|
| `uint256` | `ethers::types::U256` or `primitive_types::U256` |
| `address` | `ethers::types::Address` or `[u8; 20]` |
| `bytes32` | `[u8; 32]` |
| `bytes` | `Vec<u8>` |
| `Side enum` | `enum Side { Buy, Sell }` |
| `OrderStatus enum` | `enum OrderStatus { Pending, Filled }` |

**Async Trait Pattern:**
Use `async_trait` crate for async methods in traits:
```rust
use async_trait::async_trait;

#[async_trait]
pub trait ChainReader: Send + Sync {
    async fn get_pending_orders(&self) -> Result<Vec<LimitOrder>, Error>;
}
```

### Project Structure Notes

Create the following structure aligned with architecture.md Section 20:

```
index/
├── Cargo.toml              # Workspace manifest
├── common/                 # Shared traits and types
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── traits/
│       │   ├── mod.rs
│       │   ├── chain_reader.rs
│       │   ├── chain_writer.rs
│       │   ├── bls_signer.rs
│       │   ├── p2p_transport.rs
│       │   └── ap_client.rs
│       └── types/
│           ├── mod.rs
│           ├── order.rs
│           ├── itp.rs
│           ├── fill.rs
│           ├── price.rs
│           ├── issuer.rs
│           └── p2p.rs
├── issuer/                 # Placeholder (Epic 3)
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
└── ap/                     # Placeholder (Epic 4)
    ├── Cargo.toml
    └── src/
        └── lib.rs
```

### Critical Implementation Details

1. **BN254 Curve for BLS:**
   - Use a library compatible with EVM precompile 0x06 (bn254)
   - Recommended crate: `ark-bn254` or `bn` crate
   - Signature verification must match Solidity `BLSLib.sol` test vectors

2. **Event Subscription:**
   - ChainReader.subscribe_events should return a stream of blockchain events
   - Event types: OrderSubmitted, FillConfirmed, ITPCreated, BatchConfirmed
   - Use ethers-rs Provider with event filters

3. **Error Types:**
   - `common/src/error.rs` - Transport-level errors (ChainRead, ChainWrite, P2P, BLS, etc.)
   - `common/src/errors.rs` - Business logic errors with codes E001-E010 (IndexError)
   - Use `thiserror` derive macro for both

4. **U256 Handling:**
   - Prefer `ethers::types::U256` for blockchain compatibility
   - All amounts use 18 decimals (1e18 = 1 token)

5. **MessagePack for P2P:**
   - Use `rmp-serde` crate for serialization
   - All P2P messages must implement Serialize/Deserialize

### Dependencies (Cargo.toml suggestions)

```toml
[dependencies]
async-trait = "0.1"
thiserror = "1.0"
tokio = { version = "1", features = ["full"] }
ethers = "2"
serde = { version = "1", features = ["derive"] }
rmp-serde = "1"  # MessagePack
```

### References

- [Source: architecture.md#4-technology-stack] - P2P Protocol: TCP + TLS + MessagePack
- [Source: architecture.md#4-technology-stack] - BLS Curve: BN254 (precompile available)
- [Source: architecture.md#4-technology-stack] - Issuer P2P Message Types table
- [Source: architecture.md#6-order-system] - LimitOrder struct definition
- [Source: architecture.md#7-issuer-cycle] - Price struct with staleness
- [Source: architecture.md#20-project-structure] - Folder structure: common/, issuer/, ap/
- [Source: epics.md#story-1.2] - Full acceptance criteria

### Parallel Work Coordination

This story runs in parallel with:
- **Story 1.1 (Solidity Interfaces):** Traits here must match Solidity interfaces. Coordinate on LimitOrder, ITP, Fill struct field names.
- **Story 1.3 (Shared Types & Events):** Types defined here will be extended in 1.3 with ethers-rs bindings.
- **Story 1.5 (Mock Implementations):** Mocks will implement these traits.

**Interface Freeze:** Once traits are defined and approved, consider them frozen for Epic 1. Changes require coordination with parallel stories.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No errors encountered during implementation.

### Completion Notes List

- Created Rust workspace with three crates: `common`, `issuer`, `ap`
- Implemented all 5 core traits as specified:
  - **ChainReader**: get_pending_orders, get_itp, get_prices, get_issuer_registry, subscribe_events
  - **ChainWriter**: submit_batch, confirm_fills, submit_bridge
  - **BLSSigner**: sign, aggregate_signatures, verify (uses typed BLSPublicKey)
  - **P2PTransport**: connect_peers, broadcast, send_to, receive
  - **APClient**: place_order, get_fills, get_order_status
- Created all supporting types: LimitOrder (with status field), ITPCore, Fill, Price, Issuer, P2PMessage, etc.
- Types evolved during implementation to match Solidity TypesLib.sol via parallel Story 1-3 coordination
- All code compiles with `cargo build` and passes `cargo clippy` with no warnings
- Two error modules: `error.rs` (transport) and `errors.rs` (business logic E001-E010)
- Enum conversions use safe defaults via `From<u8>` with fallible `try_from_u8()` methods
- Comprehensive tests: 12 type tests, 8 trait tests, 2 error tests

### Change Log

- 2026-01-29: Initial implementation of Story 1.2 - All Rust traits defined, workspace structure created, compilation verified
- 2026-01-29: Code review fixes:
  - Added missing `status` field to LimitOrder struct
  - Replaced panic-on-invalid enum conversions with safe defaults + try_from_u8() methods
  - Added comprehensive trait tests with mock implementations (common/tests/traits_test.rs)
  - Updated File List to include all files (bridge.rs, errors.rs, bindings/mod.rs, tests)
  - Corrected task descriptions to match actual implementation (ITPCore fields, BLSSigner.verify signature)

### File List

**New Files:**
- Cargo.toml (workspace)
- common/Cargo.toml
- common/src/lib.rs
- common/src/error.rs (transport-level errors)
- common/src/errors.rs (business logic E001-E010)
- common/src/bindings/mod.rs (ethers-rs compatible type exports and event signatures)
- common/src/traits/mod.rs
- common/src/traits/chain_reader.rs
- common/src/traits/chain_writer.rs
- common/src/traits/bls_signer.rs
- common/src/traits/p2p_transport.rs
- common/src/traits/ap_client.rs
- common/src/types/mod.rs
- common/src/types/order.rs (includes EnumConversionError, Side, OrderStatus, LimitOrder)
- common/src/types/itp.rs
- common/src/types/fill.rs
- common/src/types/price.rs
- common/src/types/issuer.rs
- common/src/types/bridge.rs (TxType, PendingLock, CollateralMove, ReleaseProof)
- common/src/types/p2p.rs
- common/tests/types_test.rs (type serialization and conversion tests)
- common/tests/traits_test.rs (trait mock implementation and compilation tests)
- issuer/Cargo.toml
- issuer/src/lib.rs
- ap/Cargo.toml
- ap/src/lib.rs

**Note:** Some type files were enhanced by parallel Story 1-3 to align with Solidity TypesLib.sol

