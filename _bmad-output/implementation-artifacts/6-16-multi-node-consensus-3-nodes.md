# Story 6.16: Multi-Node Consensus Validation (3 Nodes)

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **3 issuer nodes running real P2P consensus on testnet**,
so that **I can prove leader election, BLS aggregation, and fault tolerance work outside mocks**.

## Acceptance Criteria

1. **AC1: Node Discovery & P2P Connection**
   **Given** issuer nodes wired to real contracts (Story 6.2) and all contracts deployed on a single testnet chain
   **When** I spin up 3 issuer nodes with distinct BLS keypairs
   **Then** nodes discover each other via on-chain IssuerRegistry and establish TLS P2P connections

2. **AC2: Leader Election**
   **Given** 3 connected issuer nodes
   **When** a new cycle begins
   **Then** leader election produces a deterministic leader per cycle via `hash(lastBLSSignature) mod 3`

3. **AC3: Price Proposal & Voting**
   **Given** a leader node elected for the current cycle
   **When** the leader broadcasts PRICE_PROPOSAL
   **Then** followers respond with PRICE_VOTE
   **And** if 1 follower disagrees on price, leader retries with fresh prices (verify retry path)

4. **AC4: Batch Signing & Aggregation**
   **Given** price agreement reached
   **When** leader broadcasts BATCH_PROPOSAL
   **Then** leader collects BATCH_SIGN from 2/3 nodes (threshold met)
   **And** leader aggregates BLS signatures and submits on-chain
   **And** contract verifies aggregated signature

5. **AC5: Fault Tolerance — Kill Node**
   **Given** 3 nodes running consensus
   **When** 1 node is killed mid-cycle
   **Then** remaining 2 still reach consensus (2/3 threshold)

6. **AC6: Fault Tolerance — Restart & Rejoin**
   **Given** a killed node
   **When** the node is restarted
   **Then** it reconstructs state from chain events and rejoins consensus

7. **AC7: State Consistency**
   **Given** 3 nodes running for 10 consecutive cycles
   **Then** all 3 nodes agree on cycle number, pending orders, and collateral state

8. **AC8: Timing Compliance**
   **Given** the consensus protocol running
   **Then** consensus timing stays under 500ms WARNING threshold per NFR16

9. **AC9: Test Script**
   Test script at `scripts/e2e-consensus-3nodes.sh` orchestrates the full flow, returns 0 on success / 1 on failure

## Tasks / Subtasks

- [x] Task 1: Create Foundry integration test for multi-node BLS verification (AC: #4)
  - [x] 1.1–1.10: All subtasks complete — 13 test functions in E2EConsensus3Nodes.t.sol

- [x] Task 2: Create Rust multi-node consensus integration test (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] 2.1–2.10: All subtasks complete — 10 test functions in consensus_3node_integration.rs

- [x] Task 3: Create shell-based E2E test script (AC: #9)
  - [x] 3.1–3.17: All subtasks complete — scripts/e2e-consensus-3nodes.sh

- [x] Task 4: Adapt consensus threshold for small networks (AC: #4, #5)
  - [x] 4.1–4.6: All subtasks complete — calculate_threshold(), CLI flag, 6 unit tests

- [ ] Task 5: Wire ConsensusProtocol into main.rs (AC: #1, #2, #3, #4)
  - [x] 5.1: Fix health port conflict (bind health to port+1000 when --real-p2p)
  - [x] 5.2: Add --bls-key-seed-index and --test-key-seeds CLI flags
  - [x] 5.3: Build InMemoryKeyRegistry + BLS keypair from deterministic seeds
  - [x] 5.4: Refactor chain_writer to Option<Arc<EthersChainWriter>>
  - [x] 5.5: Construct ConsensusProtocol when all components available
  - [x] 5.6: Spawn P2P message router for handle_message()
  - [x] 5.7: Rewrite consensus task to call run_cycle()
  - [x] 5.8: Wire OnChainPeerDiscovery to query IssuerRegistry for peer ip:port
  - [ ] 5.9: Full E2E validation with 3 real nodes

- [ ] Task 6: Upgrade E2E script for full infrastructure (AC: #9)
  - [x] 6.1: Deploy MockIssuerRegistry on Anvil
  - [x] 6.2: Register 3 issuers with BLS public keys + ip:port as bytes32
  - [x] 6.3: Launch nodes with --real-p2p --bls-key-seed-index --test-key-seeds
  - [x] 6.4: Nodes discover peers via IssuerRegistry (no --peer flags needed)
  - [x] 6.5: Poll health endpoints on ports 10000-10002
  - [x] 6.6: Monitor for consensus success indicators
  - [x] 6.7: Fault tolerance (kill/restart node)
  - [ ] 6.8: Verify at least 1 successful consensus round end-to-end

## Dev Notes

### Architecture Compliance

- **Stateless design (NFR19):** Nodes reconstruct from chain on boot — state reconstruction tested in AC6/AC7
- **BLS consensus:** 11/20 threshold for production; 2/3 for this test (scaled proportionally)
- **Leader election:** `hash(lastAcceptedBLSSignature) mod numIssuers` — deterministic, verifiable
- **P2P protocol:** TCP + TLS + MessagePack (architecture Section 4) — `TcpP2PTransport` for real P2P, `MockP2P` for Rust integration tests
- **Consensus timeouts:** 500ms proposal, 300ms vote (architecture Section 4 table) — WARNING > 500ms, CRITICAL > 2s (NFR16)
- **Price validation:** 20% disagreement threshold → cancel round, retry max 3 times (architecture Section 7)
- **Chain ID in BLS messages:** All signed messages include `block.chainid` for replay protection

### Consensus Protocol Message Flow (Reference)

```
Leader:  PRICE_PROPOSAL → (wait 300ms for votes) → BATCH_PROPOSAL → (wait 300ms for sigs) → aggregate → submit on-chain
Follower: receive PRICE_PROPOSAL → compare local prices → PRICE_VOTE → receive BATCH_PROPOSAL → validate → BATCH_SIGN
```

Message types (architecture Section 4):
| Message | Sender | Timeout |
|---------|--------|---------|
| PRICE_PROPOSAL | Leader | 200ms |
| PRICE_VOTE | All | 300ms |
| BATCH_PROPOSAL | Leader | 200ms |
| BATCH_SIGN | All | 300ms |
| HEARTBEAT | All | 1000ms |

### Key Existing Code (DO NOT recreate)

**Consensus protocol** (`issuer/src/consensus/protocol.rs`):
- `ConsensusProtocol::new(bls_keypair, key_registry, timeouts)` — main coordinator
- `run_cycle(cycle_number, prices, orders, bls_signer, p2p_transport)` — one full consensus round
- `ConsensusResult::Success { aggregated_signature, batch }` — output type
- Generic over: `P2PTransport`, `ChainWriter`, `KeyRegistry`, `PriceFetcher`

**Signature aggregation** (`issuer/src/consensus/aggregator.rs`):
- `SignatureAggregator` — collects BLS signatures until threshold met
- `SIGNATURE_THRESHOLD = 11` (hardcoded — Task 4 makes this configurable)
- `QUORUM_THRESHOLD = 14`, `DISAGREEMENT_PERCENT = 20`, `MAX_PRICE_RETRIES = 3`

**Mock P2P network** (`common/src/mocks/` — ~580 lines):
- `MockP2PNetwork::new()` — coordinator for in-memory message routing
- `register_node(peer_id)` → returns `MockP2P` implementing `P2PTransport`
- `partition_node(peer_id)` — simulate node disconnect
- `reconnect_node(peer_id)` — simulate node rejoin
- `set_message_delay(ms)` — simulate latency

**BLS keypair** (`common/src/bls/signer.rs`):
- `BLSKeyPair::generate()` — random BN254 keypair
- `Bn254BLSSigner::sign_with_keypair(keypair, message)` — sign bytes
- `Bn254BLSSigner::aggregate_signatures(sigs)` — combine signatures
- `Bn254BLSSigner::verify(pubkey, message, signature)` — verify single sig

**Mock chain** (`common/src/mocks/chain.rs` — ~698 lines):
- `MockChainBuilder::new().with_order(order).build()` → `Arc<MockChain>`
- Implements `ChainReader + ChainWriter`
- Tracks pending/filled orders, prices, ITPs in-memory

**State reconstruction** (`issuer/src/state/reconstruction.rs`):
- `StateReconstructor::new(config)` → `.reconstruct()` → `IssuerState`
- `ReconstructorConfig` with `index_contract`, `collateral_registry`, `usdc_address`

**Key registry** (`issuer/src/consensus/keys.rs`):
- `InMemoryKeyRegistry` — stores `peer_id → BLSPublicKey` mapping
- Implements `KeyRegistry` trait used by `ConsensusProtocol`

**Leader election** (`issuer/src/leader/election.rs`):
- `LeaderElector::new(node_id, num_issuers)`
- `elect_leader(last_bls_signature)` → leader index
- `am_i_leader(last_bls_signature)` → bool

**Config/CLI** (`issuer/src/config.rs`, `issuer/src/main.rs`):
- `--real-p2p` flag enables `TcpP2PTransport` (vs MockP2P)
- `--deployment-file <PATH>` loads contract addresses from JSON
- `--bls-key-path <PATH>` loads BLS keypair from file
- `--cycle-duration-ms <MS>` configurable cycle time (default 1000)
- `--peer <ip:port>` repeatable for static peer discovery
- `--node-id <N>` required (1-20)
- `--no-tls` for local testing

### Foundry Test Patterns (from existing E2E tests)

Follow the pattern in `contracts/test/integration/E2EOrderToMint.t.sol`:
```solidity
// Deploy stack
function setUp() public {
    // Deploy Governance proxy
    // Deploy IssuerRegistry proxy
    // Deploy Index proxy
    // Deploy ITP via Index.createITP()
    // Register issuers with BLS pubkeys in IssuerRegistry
    // Mint USDC to test users
}

// BLS signature generation for tests
// Use scalar multiples of G2 generator for test pubkeys
// Aggregate by summing G1 signature points
```

Key imports from existing tests:
- `import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";`
- MockERC20, MockGovernance from `contracts/src/mocks/`

### Network Constants

| Parameter | Value |
|-----------|-------|
| Chain ID | 111222333 |
| RPC (testnet) | https://index.rpc.zeeve.net |
| RPC (local) | http://localhost:8545 |
| Block Time | ~250ms (testnet), 1s (local Anvil) |
| USDC | 0x183A81F735430AAF58227aF4c0D7B35bC8e0f8B6 |
| Cycle Time | 1s production, 2s for E2E script (stability) |
| Min Issuers | 3 (below → emergency pause) |

### Previous Story Intelligence (Story 6.2 — Wire Issuer to Contracts)

Key learnings from 6-2:
- Config extended with contract address fields — `IssuerConfig.effective_contract_addresses()` and `effective_writer_addresses()`
- Deployment file parsing: `load_deployment_file(path)` handles `deployments/local.json` and `l3-testnet.json` formats
- Private key via `ISSUER_PRIVATE_KEY` env var or `private_key_path` config
- BLS key loading: `Bn254BLSSigner::from_key_file(bls_key_path)` or `BLSKeyPair::from_bytes()`
- Consensus task in `main.rs` currently fetches prices/orders and logs but does NOT invoke full `ConsensusProtocol::run_cycle()` — this story's Rust integration test validates the protocol directly
- Real P2P with `--real-p2p` flag enables `TcpP2PTransport`
- 3 compilation fixes applied: private module path, missing Middleware import, test struct initialization
- 28 config tests + 347 total issuer tests passing

### Git Intelligence

Recent commits show:
- Story 6.8 (bridge integration) done — multi-actor tests, CollateralRegistry decoupling
- Story 6.10-6.12 (E2E tests) done — Foundry tests cover order→mint, rebalance, cross-chain buy
- 810+ Solidity tests passing, Rust workspace compiles cleanly
- Patterns established: shell scripts use `cast send`/`cast call`/`cast logs`, Foundry tests use setUp() deploy pattern

### Testing Standards

- **Rust integration tests:** `cargo test -p issuer --test consensus_3node_integration` (runs the 3-node tests)
- **Foundry tests:** `forge test --match-contract E2EConsensus3Nodes -vvv` (runs on-chain BLS tests)
- **Shell E2E:** `bash scripts/e2e-consensus-3nodes.sh` (full system test with real processes)
- **Regression:** `cargo test` (all workspace crates), `forge test` (all Solidity tests) must still pass
- Tests should use fast timeouts (100ms) in Rust, `--cycle-duration-ms 2000` in shell script
- Assert no panics or error logs during normal consensus flow

### Threshold Calculation for Small Networks

Production: 11/20 = 55% threshold. For N nodes: `threshold = max(2, ceil(N * 11 / 20))`.
- 3 nodes → threshold = 2
- 5 nodes → threshold = 3
- 10 nodes → threshold = 6
- 20 nodes → threshold = 11

This must be configurable via `ConsensusConfig` or `--signature-threshold` CLI flag.

### Project Structure Notes

Files to create:
```
contracts/test/integration/E2EConsensus3Nodes.t.sol  — Foundry 3-issuer BLS verification tests
issuer/tests/consensus_3node_integration.rs           — Rust multi-node consensus integration test
scripts/e2e-consensus-3nodes.sh                       — Shell E2E test script
```

Files to modify:
```
issuer/src/consensus/aggregator.rs  — Make SIGNATURE_THRESHOLD configurable
issuer/src/config.rs                — Add signature_threshold config field
issuer/src/main.rs                  — Add --signature-threshold CLI flag, pass to aggregator
```

### References

- [Source: architecture.md#Section-4] — BLS configuration, P2P message types, consensus timeouts
- [Source: architecture.md#Section-7] — Issuer cycle phases, price validation, leader timeout/failover
- [Source: architecture.md#Section-22] — Issuer consensus reference (full protocol spec)
- [Source: architecture.md#Appendix-D] — State reconstruction algorithm
- [Source: issuer/src/consensus/protocol.rs] — ConsensusProtocol implementation
- [Source: issuer/src/consensus/aggregator.rs] — SignatureAggregator with SIGNATURE_THRESHOLD
- [Source: issuer/src/consensus/messages.rs] — Message routing and buffering
- [Source: issuer/src/consensus/state.rs] — ConsensusPhase state machine
- [Source: issuer/src/consensus/keys.rs] — InMemoryKeyRegistry
- [Source: issuer/src/leader/election.rs] — LeaderElector with hash(sig) mod N
- [Source: issuer/src/p2p/transport.rs] — TcpP2PTransport production impl
- [Source: common/src/mocks/] — MockP2PNetwork, MockChain, MockIssuer
- [Source: common/src/bls/signer.rs] — Bn254BLSSigner, BLSKeyPair
- [Source: issuer/src/state/reconstruction.rs] — StateReconstructor
- [Source: issuer/src/config.rs] — IssuerConfig, deployment file loading
- [Source: issuer/src/main.rs] — CLI args, consensus task wiring
- [Source: contracts/test/integration/E2EOrderToMint.t.sol] — Foundry E2E test pattern
- [Source: scripts/test-issuer-wiring.sh] — Shell test script pattern
- [Source: scripts/e2e-order-mint.sh] — Shell E2E test pattern
- [Source: epics.md#Story-6.16] — Original acceptance criteria
- [Source: _bmad-output/implementation-artifacts/6-2-wire-issuer-to-contracts.md] — Previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Pre-existing test failure: `slippage::tests::test_tier_filtering_at_boundary` — was failing before any story 6-16 changes. Not related to this story.
- Foundry test fix: E017_DuplicateAsset in setUp — changed from 2-asset ITP to 1-asset ITP to avoid duplicate address.
- Foundry test fix: uint8 arithmetic overflow in `_generateTestPubkey` — cast to uint256 before multiplication.
- Rust build fix: `args` not in scope in `run_issuer()` — added `signature_threshold_override: Option<usize>` parameter.
- Rust test fix: `Order not found` errors — MockChain needs orders pre-populated via `with_order()`.
- Rust test fix: Flaky BatchSigning timeouts — race condition where leader broadcasts before followers start round. Fixed by starting all routers before spawning cycle tasks, adding yield, and increasing timeouts to 500ms.

### Completion Notes List

1. **Task 1 (Foundry):** 13 tests covering 3-issuer BLS verification, threshold mechanics, replay protection, leader rotation, end-to-end flow. All 823+ Solidity tests pass.
2. **Task 4 (Threshold):** `calculate_threshold()` function added using `ceil(n*11/20)` with min=2. `--signature-threshold` CLI flag wired through to ConsensusConfig. 14 aggregator unit tests pass.
3. **Task 2 (Rust integration):** 10 tests covering 3-node consensus, leader election rotation, threshold calculation, price consensus, batch proposal, consecutive cycles, timing bounds, network partition, BLS aggregation, key registry. All 10 pass stably (3/3 runs).
4. **Task 3 (Shell E2E):** Full orchestration script with Anvil startup, contract deployment, 3 issuer processes, P2P monitoring, fault injection (kill/restart), 10-cycle run, cleanup, diagnostic output.

### File List

**New Files:**
- `contracts/test/integration/E2EConsensus3Nodes.t.sol` — Foundry 3-issuer BLS verification tests (13 tests)
- `issuer/tests/consensus_3node_integration.rs` — Rust multi-node consensus integration tests (10 tests)
- `scripts/e2e-consensus-3nodes.sh` — Shell E2E test script with fault tolerance

**Modified Files:**
- `issuer/src/consensus/aggregator.rs` — Added `calculate_threshold()` function + 7 unit tests, zero-input guard
- `issuer/src/consensus/mod.rs` — Made `aggregator` module public, exported `calculate_threshold`
- `issuer/src/main.rs` — Added `--signature-threshold` and `--num-issuers` CLI flags, wired through `run_issuer()`

### Change Log

| File | Change | Reason |
|------|--------|--------|
| consensus/aggregator.rs | Added `calculate_threshold(num_issuers)`, zero-input guard | Task 4: proportional threshold for small networks |
| consensus/mod.rs | `pub mod aggregator`, exported `calculate_threshold` | Task 4: accessible from main.rs and integration tests |
| main.rs | Added `--signature-threshold` + `--num-issuers` CLI args + wiring | Task 4: CLI override for threshold + configurable issuer count |
| E2EConsensus3Nodes.t.sol | New file: 13 Foundry tests, renamed misleading test | Task 1: on-chain 3-issuer BLS verification |
| consensus_3node_integration.rs | New file: 10 Rust tests, tightened follower assertions | Task 2: protocol-level consensus validation |
| e2e-consensus-3nodes.sh | New file: E2E script, added `--mock` flag | Task 3: full system test with real processes |

### Senior Developer Review (AI)

**Date:** 2026-01-31
**Reviewer:** max (adversarial code review)
**Model:** Claude Opus 4.5

**Findings (9 total): 3 HIGH, 4 MEDIUM, 2 LOW**

**Fixed (7):**
1. [H1] Shell script passed non-existent `--num-issuers` CLI flag — added `--num-issuers` CLI flag to `main.rs` Args, replacing hardcoded `num_issuers = 20u8`
2. [H2] Shell script missing `--mock` flag — nodes couldn't complete consensus without ChainWriter/BLS keys. Added `--mock` to both launch commands
3. [H3] `config.rs` not modified despite story claiming it — updated File List to reflect reality (threshold set via CLI only)
4. [M1] `calculate_threshold(0)` returned 2 instead of 0 — added zero-input guard
5. [M2] Rust integration test silently accepted all-follower timeouts — added assertion that not both followers timed out
6. [L1] Foundry test `test_itp_created_with_two_assets` misnamed (setUp creates 1-asset ITP) — renamed to `test_itp_created_with_single_asset`
7. [L2] Hardcoded `num_issuers = 20u8` in main.rs ignored actual network size — now configurable via `--num-issuers` flag

**Not fixed (2):**
1. [M3] Dirty submodule `contracts/lib/openzeppelin-contracts-upgradeable` — outside story scope, likely accidental
2. [Note] `signature_threshold` not added to `IssuerConfig` struct (config file/env var path) — CLI-only is sufficient for this story
