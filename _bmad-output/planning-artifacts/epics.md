---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
  - step-01-validate-prerequisites-epic8
  - step-02-design-epics-epic8
  - step-03-create-stories-epic8
  - step-04-final-validation-epic8
inputDocuments:
  - architecture.md
  - itp-morpho-lending-architectures.md
  - docs/vital-test.md
parallelDevelopment: true
status: complete
totalEpics: 8
totalStories: 89
frCoverage: 28/28 (base) + 16 Morpho FRs
---

# index - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for index, optimized for **maximum parallel development**. Architecture.md is the source of truth. All components use mocks initially, with integration/unmocking in the final epic.

## Requirements Inventory

### Functional Requirements

FR1: Users can submit limit orders to buy/sell ITP tokens with USDC
FR2: All orders must specify a slippage tier (0=≤0.3%, 1=≤1%, 2=≤3%)
FR3: Orders have deadlines (max 24 hours) with automatic USDC refund on expiry
FR4: ITP tokens are ERC4626 compliant vault tokens with weighted asset baskets
FR5: Weights must sum to 1.0 with minimum 0.25% per asset
FR6: NAV is calculated as Σ(quantity × price) / totalSupply
FR7: Anyone can permissionlessly propose new ITPs
FR8: Asset managers can propose rebalances for their ITPs
FR9: 20 issuer nodes process orders in 1-second cycles with BLS consensus
FR10: Leader election via hash(lastAcceptedBLSSignature) mod numIssuers
FR11: Orders are batched and netted (pair netting, bridge netting, USDT netting)
FR12: AP reads TradeRequest events from blockchain and executes on Bitget
FR13: Issuers verify fills via Bitget read-only API (no direct AP communication)
FR14: BLS-piloted custody contracts on multiple chains (L3, Arbitrum, Ethereum, Base, Optimism)
FR15: Squads v4 multisig for Solana custody (Ed25519 signatures)
FR16: Two-phase bridge with lock→verify→release pattern
FR17: Cross-chain swaps route through Arbitrum hub via 1inch Fusion+
FR18: Admin can trigger emergency system pause
FR19: Individual ITP pause capability for specific issues
FR20: Asset delisting triggers forced rebalance to 0% weight
FR21: Individual issuer key rotation with 10/19 approval + 24h timelock + safe period
FR22: Custody whitelist management with 11/20 approval + 2-day timelock
FR23: Cross-chain ITP purchase from Arbitrum (buy without bridging to L3)
FR24: Order queue with priority buckets (small/medium/large/xl)
FR25: AP buffer management for orders below minimum trade size
FR26: Price updates via BLS-signed batches from issuers
FR27: Fee collection: trading fees + management fees (0-10% annualized)
FR28: On-chain CollateralRegistry tracks ITP collateral per chain

### NonFunctional Requirements

NFR1: Cycle time of 1 second for order processing
NFR2: Block time ~250ms on Index L3 Orbit chain
NFR3: BLS signature verification via BN254 precompile (~100-150k gas)
NFR4: Bitget rate limit: ~10 orders/second
NFR5: Price staleness limits: 10s (CEX), 30s (DEX), 60s (low-liquidity)
NFR6: Bridge timeout: 1 hour, with 15/20 threshold for reversal
NFR7: Swap rollback timeout: 30 minutes
NFR8: AP order execution timeout: 60 seconds
NFR9: Quorum: 14/20 online for standard operation
NFR10: Minimum 3 issuers to operate (below triggers emergency pause)
NFR11: Key rotation: 24h timelock after 10/19 approval
NFR12: Custody UUPS upgrade: 7-day timelock with 15/20 approval
NFR13: Emergency upgrade: 24h timelock with 17/20 approval
NFR14: 48-hour stuck rotation admin escape hatch
NFR15: Queue depth WARNING at >100, CRITICAL at >500 (pause new orders)
NFR16: Issuer consensus timeout: WARNING >500ms, CRITICAL >2s
NFR17: AP response time WARNING >10s, CRITICAL >60s
NFR18: Log retention: ERROR/WARN 90 days, INFO 30 days, DEBUG 7 days
NFR19: Stateless issuer nodes (reconstruct state from chain on reboot)
NFR20: All storage uses uint256 for simplicity and safety

### Additional Requirements

- Starter template: Foundry-based Solidity project structure
- Two main contracts: Governance.sol + Index.sol with UUPS proxy pattern
- Rust for issuer nodes and AP/Keeper services
- TCP + TLS + MessagePack for P2P protocol
- Phase 1 admin is single EOA, Phase 2+ is multisig DAO
- IND gas token: free for protocol actors, users pay for order submission
- Error codes E001-E010 defined for standardized error handling
- JSON logging with required fields (timestamp, level, cycle_number, etc.)
- Monitoring dashboard required for real-time metrics
- BLSCustody.sol deployed on each EVM chain with same BLS public key
- ITP.sol as ERC4626 with mint/burn callable only by Index.sol
- CollateralRegistry.sol for on-chain collateral tracking
- IssuerRegistry.sol for issuer management and key rotation
- L3BridgeCustody.sol and ArbBridgeCustody.sol for two-phase bridging

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 2 | Submit limit orders (Index.sol) |
| FR2 | Epic 2 | Slippage tiers (Index.sol) |
| FR3 | Epic 2 | Order deadlines (Index.sol) |
| FR4 | Epic 2 | ERC4626 ITP tokens (ITP.sol) |
| FR5 | Epic 2 | Weight validation (Index.sol) |
| FR6 | Epic 2 | NAV calculation (Index.sol) |
| FR7 | Epic 2 | Permissionless ITP creation (Index.sol) |
| FR8 | Epic 6 | Rebalance (integration) |
| FR9 | Epic 3 | Issuer cycle processing |
| FR10 | Epic 3 | Leader election |
| FR11 | Epic 3 | Order netting engine |
| FR12 | Epic 4 | AP trade execution |
| FR13 | Epic 4 | Fill verification |
| FR14 | Epic 2 | Multi-chain BLS custody |
| FR15 | Epic 5 | Solana Squads custody |
| FR16 | Epic 2 | Two-phase bridge contracts |
| FR17 | Epic 5 | 1inch cross-chain swaps |
| FR18 | Epic 2 | Emergency system pause |
| FR19 | Epic 2 | Per-ITP pause |
| FR20 | Epic 6 | Asset delisting (integration) |
| FR21 | Epic 2 | Issuer key rotation |
| FR22 | Epic 2 | Custody whitelist management |
| FR23 | Epic 2 | Cross-chain ITP purchase |
| FR24 | Epic 3 | Order queue priority |
| FR25 | Epic 4 | AP buffer management |
| FR26 | Epic 3 | Price updates via BLS |
| FR27 | Epic 2 | Fee collection |
| FR28 | Epic 2 | CollateralRegistry |

---

## Epic List

### Epic 1: Interfaces, Types & Local Environment
Define all interfaces and mocks so parallel teams can start immediately.

**FRs covered:** Foundation for all
**Parallel unlock:** ALL other epics can start after this

**Parallel Streams (6 - all start Day 1):**
- 1A: Solidity interfaces (IIndex, IITP, IBLSCustody, ICollateralRegistry, IBridge)
- 1B: Rust traits (Chain, Issuer, AP, BLS, P2P)
- 1C: Shared types & events (Order, ITP, Fill, all events)
- 1D: Error codes (E001-E010) + custom errors lib
- 1E: Mock implementations (MockChain, MockAP, MockBitget, MockIssuer)
- 1F: Local environment (anvil setup, start.sh, docker-compose)

---

### Epic 2: Smart Contracts
All Solidity contracts complete and tested against mocks.

**FRs covered:** FR1-7, FR14, FR16, FR18-22, FR23, FR27-28
**NFRs covered:** NFR3, NFR6, NFR11-14, NFR20

**Parallel Streams (10 total, 6 immediate):**
- 2A: Governance.sol (admin, pause, issuer registry) - immediate
- 2B: Index.sol core (storage, orders, ITPs, cycles) - immediate
- 2C: ITP.sol (ERC4626, mint/burn) - immediate
- 2D: BLS library Solidity (ecAdd, ecNegate, verify) - immediate
- 2E: BLSCustody.sol (execute, whitelist, nonce bitmap) - after 2D
- 2F: L3BridgeCustody.sol (lock, release, reverse) - after 2E
- 2G: ArbBridgeCustody.sol (completeBridge, cross-chain buy) - after 2E
- 2H: CollateralRegistry.sol - immediate
- 2I: IssuerRegistry.sol (key rotation, safe period) - after 2A, 2D
- 2J: Foundry tests for each contract - parallel with each

---

### Epic 3: Issuer Node
Complete issuer node that works against mock chain and mock AP.

**FRs covered:** FR9-11, FR24, FR26
**NFRs covered:** NFR1, NFR5, NFR9, NFR10, NFR16, NFR19

**Parallel Streams (14 total, 10 immediate):**
- 3A: Binary skeleton + CLI args + config - immediate
- 3B: Chain reader (events, state queries) against mock - immediate
- 3C: Chain writer (tx submission) against mock - immediate
- 3D: State reconstruction algorithm - after 3B
- 3E: Cycle manager (timing, phases) - immediate
- 3F: Order batcher (collect, validate) - immediate
- 3G: Netting engine (pair, bridge, USDT, fee allocation) - immediate
- 3H: Slippage filter & fill allocation - immediate
- 3I: BLS library Rust (BN254, sign, aggregate) - immediate
- 3J: P2P transport (TCP + TLS + MessagePack) - immediate
- 3K: Leader election - after 3I
- 3L: Consensus flow (propose, vote, aggregate) - after 3I, 3J
- 3M: Price fetching & staleness validation - immediate
- 3N: Heartbeat & issuer health - after 3J

---

### Epic 4: AP/Keeper Service
Complete AP service that works against mock chain and mock CEX.

**FRs covered:** FR12, FR13, FR25
**NFRs covered:** NFR4, NFR8, NFR17

**Parallel Streams (9 total, all immediate):**
- 4A: Binary skeleton + CLI args + config
- 4B: Event monitor (TradeRequest, Withdrawal) against mock
- 4C: Order queue manager (FIFO, priorities)
- 4D: Fill reporter (build tx, submit) against mock
- 4E: Buffer manager (track debt, accumulate)
- 4F: Limit order enforcer (validate prices)
- 4G: Timeout handler (60s, retry logic)
- 4H: Mock Bitget client (simulated order book, fills)
- 4I: AP metrics & health reporting

---

### Epic 5: External Integrations
All third-party integrations working in isolation.

**FRs covered:** FR15, FR17
**NFRs covered:** NFR5, NFR7

**Parallel Streams (12 total, 10 immediate):**
- 5A: Bitget API client (auth, order placement) - immediate
- 5B: Bitget read-only API (fills, order status) - immediate
- 5C: Bitget rate limiter (10/sec, backoff) - immediate
- 5D: 1inch quote API client - immediate
- 5E: 1inch quote cache (5s TTL) - after 5D
- 5F: 1inch swap calldata builder - immediate
- 5G: 1inch Fusion+ client (cross-chain intents) - immediate
- 5H: 1inch rate limit handler (multi-key, backoff) - after 5D
- 5I: On-chain fallback (read Uniswap reserves) - immediate
- 5J: Squads v4 SDK integration - immediate
- 5K: Ed25519 key manager for Solana - immediate
- 5L: Jupiter aggregator client - immediate

---

### Epic 6: Integration, Unmocking & Go-Live
Wire everything together, replace mocks, full system works end-to-end.

**FRs covered:** FR8, FR20 + all integration
**NFRs covered:** NFR15-18

**Parallel Streams (18 total, 3 immediate, 15 after dependencies):**
- 6A: Deploy contracts to L3 testnet - after Epic 2
- 6B: Wire issuer to real contracts - after Epic 2, 3
- 6C: Wire AP to real contracts - after Epic 2, 4
- 6D: Wire AP to real Bitget - after Epic 4, 5A-C
- 6E: Deploy BLSCustody to Arbitrum - after Epic 2
- 6F: Deploy BLSCustody to Ethereum/Base/Optimism - after Epic 2
- 6G: Wire issuer to 1inch - after Epic 3, 5D-I
- 6H: Bridge integration test (L3↔Arb) - after 6A, 6E
- 6I: Squads integration test - after Epic 5J-L
- 6J: E2E: Order → Fill → Mint - after 6B, 6C, 6D
- 6K: E2E: Rebalance flow - after 6J
- 6L: E2E: Cross-chain buy from Arb - after 6E, 6H
- 6M: Monitoring & alerting setup - immediate
- 6N: Logging infrastructure - immediate
- 6O: Error handling audit - immediate
- 6P: Multi-node consensus validation (3 nodes) - after 6B
- 6Q: Inventory rebalancing with Bitget settlement - after 6P, 6H
- 6R: Full system E2E (3 nodes + AP + mock Bitget + bridges) - after 6Q, 6J, 6L

---

## Parallel Development Summary

| Epic | Total Streams | Immediate Start | After Dependencies |
|------|---------------|-----------------|-------------------|
| 1 | 6 | 6 | 0 |
| 2 | 10 | 6 | 4 |
| 3 | 14 | 10 | 4 |
| 4 | 9 | 9 | 0 |
| 5 | 12 | 10 | 2 |
| 6 | 18 | 3 | 15 |

**Peak parallelism:** After Epic 1, **35+ parallel streams** can run across Epics 2-5.

---

## Epic 1: Interfaces, Types & Local Environment

Define all interfaces and mocks so parallel teams can start immediately.

### Story 1.1: Solidity Interfaces

As a **smart contract developer**,
I want **all Solidity interfaces defined (IIndex, IITP, IBLSCustody, ICollateralRegistry, IBridge, IIssuerRegistry, IGovernance)**,
So that **I can implement contracts against stable interfaces while other teams work in parallel**.

**Acceptance Criteria:**

**Given** a new Foundry project at `contracts/`
**When** I create the interfaces in `contracts/src/interfaces/`
**Then** IIndex.sol defines: submitOrder, confirmBatch, confirmFills, createITP, getOrder, getITP, getNAV
**And** IITP.sol defines: ERC4626 interface + mint/burn restricted to Index
**And** IBLSCustody.sol defines: execute, proposeWhitelist, activateWhitelist, emergencyRemoveWhitelist
**And** ICollateralRegistry.sol defines: recordCollateralMove, getITPCollateralByChain
**And** IBridge.sol defines: initiateBridge, markReleased, reverseLock, completeBridge
**And** IIssuerRegistry.sol defines: addIssuer, removeIssuer, requestKeyRotation, approveRotation, executeRotation
**And** IGovernance.sol defines: pause, unpause, pauseITP, setAdmin
**And** all interfaces compile with `forge build`

---

### Story 1.2: Rust Traits

As an **issuer/AP developer**,
I want **all Rust traits defined for Chain, Issuer, AP, BLS, and P2P interactions**,
So that **I can implement components against stable interfaces while other teams work in parallel**.

**Acceptance Criteria:**

**Given** a Rust workspace with `issuer/` and `ap/` crates
**When** I create shared traits in `common/src/traits/`
**Then** ChainReader trait defines: get_pending_orders, get_itp, get_prices, get_issuer_registry, subscribe_events
**And** ChainWriter trait defines: submit_batch, confirm_fills, submit_bridge
**And** BLSSigner trait defines: sign, aggregate_signatures, verify
**And** P2PTransport trait defines: broadcast, send_to, receive, connect_peers
**And** APClient trait defines: place_order, get_fills, get_order_status
**And** all traits compile with `cargo build`

---

### Story 1.3: Shared Types & Events

As a **developer on any component**,
I want **all shared types and events defined consistently across Solidity and Rust**,
So that **all components use identical data structures**.

**Acceptance Criteria:**

**Given** interfaces from Story 1.1 and traits from Story 1.2
**When** I define shared types
**Then** Solidity structs exist for: LimitOrder, ITPCore, Fill, Price, BridgeLock, CollateralMove
**And** Solidity events exist for: OrderSubmitted, BatchConfirmed, FillConfirmed, TradeRequest, ITPCreated, BridgeLockConfirmed, BridgeCompleted
**And** Rust structs mirror all Solidity structs with matching field names and types
**And** Rust has ethers-rs bindings generated from Solidity ABIs
**And** types documentation matches architecture.md Section 6 (Order System) and Appendix B

---

### Story 1.4: Error Codes Library

As a **developer debugging issues**,
I want **standardized error codes (E001-E010) implemented in both Solidity and Rust**,
So that **errors are consistent and debuggable across all components**.

**Acceptance Criteria:**

**Given** error codes defined in architecture.md Section 21
**When** I implement the errors library
**Then** Solidity has `ErrorsLib.sol` with custom errors: OrderBelowMin, InsufficientBalance, ITPPaused, SystemPaused, LimitOutOfBounds, ITPNotFound, AssetDelisting, SourceUnavailable, OrderExpired, FillIncomplete
**And** each error includes the error code (E001-E010) in its name or message
**And** Rust has matching error enum with Display impl showing error codes
**And** error codes are documented in both codebases

---

### Story 1.5: Mock Implementations

As a **developer testing my component**,
I want **mock implementations for all external dependencies**,
So that **I can develop and test without real chain/CEX/other components**.

**Acceptance Criteria:**

**Given** traits from Story 1.2
**When** I implement mocks
**Then** MockChain implements ChainReader + ChainWriter with in-memory state
**And** MockChain can simulate: order submission, batch confirmation, fill confirmation, ITP creation
**And** MockBitget implements APClient with simulated order book and fills
**And** MockBitget supports configurable latency and failure injection
**And** MockIssuer implements consensus simulation for single-node testing
**And** MockP2P implements P2PTransport with in-memory message passing
**And** all mocks have builder pattern for test configuration

---

### Story 1.6: Local Development Environment

As a **developer starting work**,
I want **a working local environment with start.sh**,
So that **I can run the full system locally with mocks**.

**Acceptance Criteria:**

**Given** all interfaces, types, and mocks from Stories 1.1-1.5
**When** I run `./start.sh`
**Then** Anvil starts on port 8545 with chain ID 111222333
**And** contracts are deployed to local Anvil
**And** 3 mock issuer nodes start on ports 9001-9003
**And** 1 mock AP starts on port 9100
**And** logs are written to `logs/` directory
**And** `./start.sh --help` shows available options
**And** `./stop.sh` cleanly shuts down all processes
**And** docker-compose.yml is provided as alternative

---

## Epic 2: Smart Contracts

All Solidity contracts complete and tested against mocks.

### Story 2.1: Governance.sol - Admin & Pause

As an **admin**,
I want **a Governance contract with pause/unpause and admin management**,
So that **I can control the system in emergencies**.

**Acceptance Criteria:**

**Given** IGovernance interface from Epic 1
**When** I implement Governance.sol with UUPS proxy
**Then** `pause()` stops all order processing system-wide (requires admin)
**And** `unpause()` resumes order processing (requires admin)
**And** `pauseITP(itpId)` pauses a specific ITP only
**And** `unpauseITP(itpId)` resumes a specific ITP
**And** `setAdmin(newAdmin)` transfers admin (requires current admin)
**And** contract is UUPS upgradeable with `_authorizeUpgrade` checking admin
**And** emits Paused, Unpaused, ITPPaused, ITPUnpaused, AdminChanged events
**And** Foundry tests cover all functions and access control

---

### Story 2.2: Index.sol - Storage & ITP Creation

As a **user**,
I want **to create ITPs with weighted asset baskets**,
So that **I can deploy new index products permissionlessly**.

**Acceptance Criteria:**

**Given** IIndex interface and Governance.sol from Story 2.1
**When** I implement Index.sol storage and ITP creation
**Then** `createITP(name, symbol, weights[], assets[])` creates new ITP
**And** weights are validated to sum to 1e18 (100%)
**And** minimum weight per asset is 0.25% (25e14)
**And** each ITP gets unique itpId
**And** ITPCreated event emitted with all parameters
**And** `getITP(itpId)` returns ITP details
**And** storage uses uint256 for all values per NFR20
**And** Foundry tests cover creation, validation, and edge cases

---

### Story 2.3: Index.sol - Order Submission

As a **user**,
I want **to submit limit orders with slippage tiers and deadlines**,
So that **I can buy/sell ITP tokens with price protection**.

**Acceptance Criteria:**

**Given** Index.sol with ITP storage from Story 2.2
**When** I implement order submission
**Then** `submitOrder(itpId, side, amount, limitPrice, slippageTier, deadline)` creates order
**And** slippageTier validates: 0 (≤0.3%), 1 (≤1%), 2 (≤3%)
**And** deadline validates: max 24 hours from submission
**And** limitPrice validates: within 50% of current price
**And** amount validates: minimum 0.001 USDC (1e15 wei)
**And** USDC transferred from user to Index.sol custody
**And** OrderSubmitted event emitted with orderId and all parameters
**And** `getOrder(orderId)` returns order details
**And** reverts with appropriate error codes (E001, E002, E005)
**And** Foundry tests cover all validations and edge cases

---

### Story 2.4: Index.sol - Batch & Fill Confirmation

As an **issuer**,
I want **to confirm order batches and fills via BLS signatures**,
So that **users receive their ITP tokens after trades execute**.

**Acceptance Criteria:**

**Given** Index.sol with orders from Story 2.3
**When** I implement batch and fill confirmation
**Then** `confirmBatch(cycleNumber, orderIds[], blsSignature)` marks orders as batched
**And** `confirmFills(cycleNumber, fills[], blsSignature)` processes fills
**And** fills include: orderId, fillPrice, fillAmount
**And** BLS signature verified against aggregated public key (mock for now)
**And** cycle number prevents replay (cycleProcessed mapping)
**And** TradeRequest event emitted for AP to read
**And** FillConfirmed event emitted per fill
**And** ITP tokens minted to user based on fill
**And** Foundry tests cover happy path and replay protection

---

### Story 2.5: ITP.sol - ERC4626 Vault

As a **DeFi protocol**,
I want **ITPs to be ERC4626 compliant**,
So that **I can integrate ITPs into yield aggregators and other protocols**.

**Acceptance Criteria:**

**Given** IITP interface from Epic 1
**When** I implement ITP.sol
**Then** contract inherits OpenZeppelin ERC4626
**And** `totalAssets()` returns computed value from inventory × prices
**And** `convertToShares(assets)` returns standard ERC4626 calculation
**And** `convertToAssets(shares)` returns standard ERC4626 calculation
**And** `mint(to, shares)` only callable by Index.sol
**And** `burn(from, shares)` only callable by Index.sol
**And** `deposit()` and `withdraw()` revert (must go through Index.sol orders)
**And** assetPrices mapping updated by Index.sol
**And** Foundry tests verify ERC4626 compliance and access control

---

### Story 2.6: BLS Library Solidity

As a **contract developer**,
I want **BLS signature verification using BN254 precompiles**,
So that **I can verify 11/20 issuer consensus on-chain**.

**Acceptance Criteria:**

**Given** architecture.md BLS specification (Section 4)
**When** I implement BLSLib.sol
**Then** `ecAdd(p1, p2)` calls precompile 0x06 for point addition
**And** `ecNegate(p)` computes -P = (P.x, -P.y mod p)
**And** `verifyBLS(pubkey, message, signature)` verifies BLS signature
**And** gas cost is ~100-150k per verification
**And** library handles malformed inputs gracefully
**And** Foundry tests verify against known test vectors
**And** tests verify gas consumption is within bounds

---

### Story 2.7: BLSCustody.sol - Core Execution

As an **issuer**,
I want **a BLS-piloted custody contract for executing swaps**,
So that **assets can be managed securely with threshold signatures**.

**Acceptance Criteria:**

**Given** BLSLib.sol from Story 2.6
**When** I implement BLSCustody.sol
**Then** `execute(target, data, blsSignature, nonce)` executes arbitrary call
**And** nonce uses bitmap pattern (not sequential) to prevent gap attacks
**And** message includes: chainId, address(this), target, data, nonce
**And** target must be in whitelistedTargets mapping
**And** BLS signature verified via BLSLib
**And** Executed event emitted with target, data, nonce
**And** contract is UUPS upgradeable
**And** Foundry tests cover execution, replay protection, whitelist

---

### Story 2.8: BLSCustody.sol - Whitelist Management

As an **issuer network**,
I want **to manage custody whitelists with timelock**,
So that **new swap targets can be added securely**.

**Acceptance Criteria:**

**Given** BLSCustody.sol from Story 2.7
**When** I implement whitelist management
**Then** `proposeWhitelist(target, blsSignature)` queues target with 2-day timelock
**And** proposal requires 11/20 BLS threshold
**And** `activateWhitelist(target)` activates after timelock (anyone can call)
**And** `emergencyRemoveWhitelist(target, blsSignature)` removes immediately
**And** emergency removal requires 15/20 BLS threshold
**And** WhitelistProposed, WhitelistActivated, WhitelistRemoved events emitted
**And** Foundry tests cover timelock, thresholds, and edge cases

---

### Story 2.9: L3BridgeCustody.sol - Source Lock

As an **issuer**,
I want **to lock USDC on L3 for bridging to other chains**,
So that **cross-chain transfers use two-phase commit for safety**.

**Acceptance Criteria:**

**Given** BLSCustody.sol from Story 2.7
**When** I implement L3BridgeCustody.sol
**Then** `initiateBridge(destChainId, amount, blsSignature)` locks USDC in escrow
**And** PendingLock struct stores: amount, destChainId, lockedAt, lockedBlock, lockedBlockHash
**And** BridgeLockConfirmed event includes block.number and blockhash(block.number - 1)
**And** `markReleased(nonce, destTxHash, blsSignature)` marks lock as released
**And** `reverseLock(nonce, blsSignature, signerCount)` reverses after 1-hour timeout
**And** reversal requires 15/20 threshold
**And** Foundry tests cover lock, release, reversal, and timeout

---

### Story 2.10: ArbBridgeCustody.sol - Destination Release

As an **issuer**,
I want **to release USDC on Arbitrum after verifying L3 lock**,
So that **bridged funds can be used for swaps**.

**Acceptance Criteria:**

**Given** L3BridgeCustody.sol from Story 2.9
**When** I implement ArbBridgeCustody.sol
**Then** `completeBridge(sourceChainId, amount, nonce, proof, blsSignature)` releases USDC
**And** proof includes: sourceBlockNumber, sourceBlockHash, sourceTxHash
**And** nonce tracked in bridgeCompleted mapping to prevent replay
**And** BridgeCompleted event emitted
**And** `buyITPFromArbitrum(itpId, amount, limitPrice, slippageTier, deadline)` for cross-chain buy
**And** CrossChainBuyRequest event emitted for issuers
**And** Foundry tests cover release, replay protection, cross-chain buy

---

### Story 2.11: CollateralRegistry.sol

As an **issuer**,
I want **on-chain tracking of collateral per ITP per chain**,
So that **state can be reconstructed from chain events**.

**Acceptance Criteria:**

**Given** ICollateralRegistry interface from Epic 1
**When** I implement CollateralRegistry.sol
**Then** `recordCollateralMove(itpId, fromChain, toChain, amount, txType, blsSignature)` updates state
**And** itpCollateralByChain mapping tracks: itpId → chainId → amount
**And** txType enum: BRIDGE, SWAP_IN, SWAP_OUT, BUY, SELL
**And** CollateralMoved event emitted with all parameters
**And** `getITPCollateralByChain(itpId, chainId)` returns current amount
**And** BLS signature required for all updates
**And** Foundry tests cover all move types and state consistency

---

### Story 2.12: IssuerRegistry.sol - Core Registry

As an **admin**,
I want **to manage the issuer network on-chain**,
So that **issuer addresses, IPs, and BLS keys are discoverable**.

**Acceptance Criteria:**

**Given** Governance.sol from Story 2.1 and BLSLib from Story 2.6
**When** I implement IssuerRegistry.sol core
**Then** `addIssuer(address, ip, blsPubkey)` adds issuer (admin only)
**And** aggregatedPubkey updated via ecAdd
**And** `removeIssuer(issuerId)` removes issuer (admin or BLS vote)
**And** aggregatedPubkey updated via ecAdd(ecNegate())
**And** IssuerAdded, IssuerRemoved events with new aggregatedPubkey
**And** `getIssuer(issuerId)` returns address, ip, pubkey, active status
**And** `getAggregatedPubkey()` returns current aggregated key
**And** Foundry tests cover add, remove, key recalculation

---

### Story 2.13: IssuerRegistry.sol - Key Rotation

As an **issuer**,
I want **to rotate my BLS key with approval from other issuers**,
So that **I can recover from key compromise or upgrade hardware**.

**Acceptance Criteria:**

**Given** IssuerRegistry.sol from Story 2.12
**When** I implement key rotation
**Then** `requestKeyRotation(issuerId, newPubkey, signatureWithOldKey)` creates request
**And** `approveRotation(rotatingIssuerId, approvingIssuerId, approverSignature)` adds approval
**And** rotating issuer cannot self-approve
**And** 10/19 other issuers required for approval
**And** `executeRotation(issuerId)` executes after 24h timelock + safe period check
**And** safe period requires: previous cycle confirmed, no pending settlements, cycle idle
**And** old key valid for 10 more cycles (grace period)
**And** `forceRotationWindow(issuerId)` admin escape after 48h stuck
**And** RotationRequested, RotationApproved, KeyRotated events
**And** Foundry tests cover full rotation flow and edge cases

---

## Epic 3: Issuer Node

Complete issuer node that works against mock chain and mock AP.

### Story 3.1: Binary Skeleton & CLI

As an **issuer operator**,
I want **an issuer binary with CLI args and config**,
So that **I can start and configure the issuer node**.

**Acceptance Criteria:**

**Given** Rust workspace from Epic 1
**When** I implement the issuer binary skeleton
**Then** `issuer --help` shows available options
**And** `--node-id <ID>` sets issuer ID (required)
**And** `--port <PORT>` sets P2P listen port (default 9000)
**And** `--rpc <URL>` sets chain RPC endpoint
**And** `--config <PATH>` loads config from YAML/TOML file
**And** config file supports: node_id, port, rpc_url, bls_key_path, peers[]
**And** environment variables override config (ISSUER_NODE_ID, etc.)
**And** graceful shutdown on SIGTERM/SIGINT
**And** version command shows build info

---

### Story 3.2: Chain Reader

As an **issuer**,
I want **to read pending orders and state from the chain**,
So that **I can process orders in each cycle**.

**Acceptance Criteria:**

**Given** ChainReader trait from Epic 1
**When** I implement chain reader against mock
**Then** `get_pending_orders()` returns all orders with status PENDING
**And** `get_itp(itpId)` returns ITP details (weights, assets, totalSupply)
**And** `get_prices()` returns current prices for all assets
**And** `get_issuer_registry()` returns all issuers with pubkeys
**And** `subscribe_events(filter)` returns async stream of events
**And** events include: OrderSubmitted, FillConfirmed, ITPCreated
**And** works against MockChain from Epic 1
**And** unit tests verify all queries return expected data

---

### Story 3.3: Chain Writer

As an **issuer**,
I want **to submit transactions to the chain**,
So that **batches and fills can be confirmed on-chain**.

**Acceptance Criteria:**

**Given** ChainWriter trait from Epic 1
**When** I implement chain writer against mock
**Then** `submit_batch(cycleNumber, orderIds, blsSignature)` submits batch tx
**And** `confirm_fills(cycleNumber, fills, blsSignature)` submits fill confirmation
**And** `submit_bridge(destChain, amount, blsSignature)` initiates bridge
**And** transactions are signed with issuer's ETH key
**And** nonce management handles concurrent submissions
**And** gas estimation with configurable multiplier
**And** retry logic with exponential backoff on failure
**And** works against MockChain from Epic 1
**And** unit tests verify transaction submission

---

### Story 3.4: State Reconstruction

As an **issuer**,
I want **to reconstruct state from chain events on startup**,
So that **I can restart without losing track of orders**.

**Acceptance Criteria:**

**Given** ChainReader from Story 3.2
**When** I implement state reconstruction
**Then** on startup, issuer reads all events from block 0 (or checkpoint)
**And** rebuilds: pending orders, ITP inventory, collateral positions
**And** identifies current cycle number from last BatchConfirmed
**And** identifies pending fills awaiting confirmation
**And** checkpoint system saves state periodically for faster restart
**And** `--from-block <N>` flag allows starting from specific block
**And** logs reconstruction progress (X events processed)
**And** unit tests verify state matches expected after replay

---

### Story 3.5: Cycle Manager

As an **issuer**,
I want **to manage 1-second cycles with distinct phases**,
So that **order processing happens in coordinated batches**.

**Acceptance Criteria:**

**Given** architecture.md Section 7 (Issuer Cycle)
**When** I implement cycle manager
**Then** cycles run every 1 second (configurable for testing)
**And** each cycle has phases: PROCESS_FILLS → NETTING → INVENTORY_CHECK → GENERATE_BATCH → SIGN_SUBMIT
**And** phase transitions are logged with timestamps
**And** cycle number increments monotonically
**And** `get_current_cycle()` returns current cycle number
**And** `get_cycle_phase()` returns current phase
**And** cycle timing uses wall clock + NTP (±200ms tolerance)
**And** unit tests verify phase transitions and timing

---

### Story 3.6: Order Batcher

As an **issuer**,
I want **to collect and validate orders for batching**,
So that **only valid orders are included in execution**.

**Acceptance Criteria:**

**Given** ChainReader from Story 3.2
**When** I implement order batcher
**Then** `collect_orders()` gathers all pending orders from chain
**And** validates: order not expired (deadline > now)
**And** validates: ITP not paused
**And** validates: system not paused
**And** expired orders queued for refund (separate batch)
**And** orders grouped by ITP for processing
**And** `get_batch(cycleNumber)` returns validated orders for cycle
**And** unit tests verify validation logic and expiry handling

---

### Story 3.7: Netting Engine

As an **issuer**,
I want **to net orders for efficient execution**,
So that **trading volume and costs are minimized**.

**Acceptance Criteria:**

**Given** architecture.md Section 8 (Unified Netting Engine)
**When** I implement netting engine
**Then** `pair_netting(orders)` merges same-pair orders (buy $10k - sell $3k = net buy $7k)
**And** `bridge_netting(transfers)` nets opposite-direction bridges
**And** `usdt_netting(orders)` nets USDC↔USDT flows
**And** USDT netting disabled if depeg > 0.5%
**And** `fee_allocation(batch, fees)` distributes costs proportionally to order size
**And** output is list of MergedOrders with source order tracking
**And** unit tests verify netting reduces volume correctly
**And** unit tests verify fee allocation is proportional

---

### Story 3.8: Slippage Filter & Fill Allocation

As an **issuer**,
I want **to filter orders by slippage tier and allocate fills**,
So that **users get price protection and fair distribution**.

**Acceptance Criteria:**

**Given** architecture.md Section 8 (Slippage Tiered Buckets)
**When** I implement slippage filtering
**Then** `filter_by_slippage(orders, currentSpread)` excludes orders where spread > tier limit
**And** Tier 0 (≤0.3%), Tier 1 (≤1%), Tier 2 (≤3%)
**And** excluded orders remain pending for next cycle
**And** `allocate_fills(mergedOrder, fill)` distributes fill to source orders proportionally
**And** each source order gets: fill × (orderAmount / totalMergedAmount)
**And** rounding errors go to largest order
**And** unit tests verify tier filtering and allocation math

---

### Story 3.9: BLS Library Rust

As an **issuer**,
I want **BLS signing and aggregation in Rust**,
So that **I can participate in consensus**.

**Acceptance Criteria:**

**Given** BLSSigner trait from Epic 1
**When** I implement BLS library for BN254
**Then** `generate_keypair()` creates new BLS keypair
**And** `sign(privateKey, message)` produces BLS signature
**And** `aggregate_signatures(signatures[])` combines into single signature
**And** `verify(publicKey, message, signature)` verifies signature
**And** `aggregate_pubkeys(pubkeys[])` combines public keys
**And** key serialization/deserialization for storage
**And** compatible with Solidity BLSLib (same test vectors pass)
**And** unit tests verify signing, aggregation, verification

---

### Story 3.10: P2P Transport

As an **issuer**,
I want **P2P communication with other issuers**,
So that **we can coordinate consensus**.

**Acceptance Criteria:**

**Given** P2PTransport trait from Epic 1
**When** I implement TCP + TLS + MessagePack transport
**Then** `connect_peers(peers[])` establishes connections to peer issuers
**And** peers discovered from on-chain IssuerRegistry
**And** TLS with mutual authentication (issuer certs)
**And** `broadcast(message)` sends to all connected peers
**And** `send_to(peerId, message)` sends to specific peer
**And** `receive()` returns async stream of incoming messages
**And** automatic reconnection on disconnect
**And** message types defined per architecture.md Section 4
**And** unit tests verify message send/receive with MockP2P

---

### Story 3.11: Leader Election

As an **issuer**,
I want **deterministic leader election per cycle**,
So that **one issuer coordinates each cycle**.

**Acceptance Criteria:**

**Given** BLS library from Story 3.9
**When** I implement leader election
**Then** `elect_leader(lastBLSSignature, numIssuers)` returns leader index
**And** formula: hash(lastAcceptedBLSSignature) mod numIssuers
**And** `am_i_leader(cycleNumber)` returns bool
**And** leader rotates predictably based on previous signature
**And** handles issuer removal (recalculates with new count)
**And** unit tests verify deterministic election across nodes

---

### Story 3.12: Consensus Flow

As an **issuer**,
I want **to participate in BLS consensus**,
So that **batches are approved by 11/20 issuers**.

**Acceptance Criteria:**

**Given** BLS library from Story 3.9 and P2P from Story 3.10
**When** I implement consensus flow
**Then** leader broadcasts PRICE_PROPOSAL with prices
**And** followers respond with PRICE_VOTE (agree/disagree)
**And** if ≥20% disagree, retry with fresh prices (max 3 retries)
**And** leader broadcasts BATCH_PROPOSAL with orders
**And** followers respond with BATCH_SIGN (their BLS signature)
**And** leader aggregates signatures when 11/20 received
**And** leader submits aggregated signature on-chain
**And** timeout handling: 500ms for proposals, 300ms for votes
**And** unit tests verify consensus with mock P2P network

---

### Story 3.13: Price Fetching & Staleness

As an **issuer**,
I want **to fetch and validate prices**,
So that **orders execute at fair market prices**.

**Acceptance Criteria:**

**Given** architecture.md Section 7 (Price Validation)
**When** I implement price fetching
**Then** `fetch_prices(assets[])` returns prices with timestamps
**And** price source: Bitget API (mock for now)
**And** staleness limits: 10s (CEX), 30s (DEX), 60s (low-liquidity)
**And** `validate_staleness(prices)` returns bool
**And** stale prices trigger batch rejection
**And** price tolerance: 0.5% for stables, 2% for BTC/ETH
**And** `compare_prices(mine, leaders)` returns agree/disagree
**And** unit tests verify staleness detection and tolerance

---

### Story 3.14: Heartbeat & Health

As an **issuer operator**,
I want **heartbeat monitoring between issuers**,
So that **unhealthy issuers can be detected**.

**Acceptance Criteria:**

**Given** P2P transport from Story 3.10
**When** I implement heartbeat
**Then** HEARTBEAT message sent to all peers every 1 second
**And** track last_seen timestamp per peer
**And** peer marked unhealthy if no heartbeat for 5 seconds
**And** `get_healthy_peers()` returns list of healthy peer IDs
**And** `get_peer_health(peerId)` returns health status
**And** after 3 consecutive misses, propose kick vote (logged, not auto-executed)
**And** health metrics exposed for monitoring
**And** unit tests verify health tracking and timeout detection

---

## Epic 4: AP/Keeper Service

Complete AP service that works against mock chain and mock CEX.

### Story 4.1: Binary Skeleton & CLI

As an **AP operator**,
I want **an AP binary with CLI args and config**,
So that **I can start and configure the AP service**.

**Acceptance Criteria:**

**Given** Rust workspace from Epic 1
**When** I implement the AP binary skeleton
**Then** `ap --help` shows available options
**And** `--port <PORT>` sets API listen port (default 9100)
**And** `--rpc <URL>` sets chain RPC endpoint
**And** `--config <PATH>` loads config from YAML/TOML file
**And** config supports: port, rpc_url, bitget_api_key, bitget_api_secret
**And** environment variables override config (AP_PORT, BITGET_API_KEY, etc.)
**And** graceful shutdown on SIGTERM/SIGINT
**And** version command shows build info

---

### Story 4.2: Event Monitor

As an **AP**,
I want **to monitor TradeRequest events from the chain**,
So that **I know which orders to execute**.

**Acceptance Criteria:**

**Given** ChainReader trait from Epic 1
**When** I implement event monitoring
**Then** subscribes to TradeRequest events on Index.sol
**And** subscribes to WithdrawalRequest events
**And** parses event data: orderId, pairId, side, amount, limitPrice
**And** queues events for processing
**And** handles chain reorgs (re-process from safe block)
**And** tracks last processed block for restart
**And** works against MockChain from Epic 1
**And** unit tests verify event parsing and queuing

---

### Story 4.3: Order Queue Manager

As an **AP**,
I want **to manage a queue of orders to execute**,
So that **orders are processed in correct order**.

**Acceptance Criteria:**

**Given** events from Story 4.2
**When** I implement order queue
**Then** orders queued in FIFO order by arrival
**And** priority buckets: small (<$100), medium ($100-$1k), large ($1k-$10k), xl (>$10k)
**And** fair scheduling across buckets (30%, 30%, 20%, 20%)
**And** `get_next_order()` returns next order to process
**And** `mark_complete(orderId)` removes from queue
**And** `mark_failed(orderId, reason)` moves to retry queue
**And** `get_queue_depth()` returns current queue size
**And** unit tests verify FIFO ordering and bucket fairness

---

### Story 4.4: Fill Reporter

As an **AP**,
I want **to report fills back to the chain**,
So that **issuers can verify and confirm fills**.

**Acceptance Criteria:**

**Given** ChainWriter trait from Epic 1
**When** I implement fill reporter
**Then** `report_fill(orderId, fillPrice, fillAmount, txHash)` submits to chain
**And** fill data includes: Bitget order ID, execution timestamp
**And** batches multiple fills into single transaction when possible
**And** retry logic with exponential backoff on failure
**And** tracks pending fill reports
**And** works against MockChain from Epic 1
**And** unit tests verify fill submission and batching

---

### Story 4.5: Buffer Manager

As an **AP**,
I want **to manage a buffer for small orders**,
So that **orders below exchange minimum can be filled instantly**.

**Acceptance Criteria:**

**Given** architecture.md Section 9 (AP Buffer Strategy)
**When** I implement buffer manager
**Then** maintains buffer balance per asset (USDC + small amounts of traded assets)
**And** orders below minBuyAmount filled from buffer instantly
**And** buffer can go into debt (negative balance)
**And** when debt >= minBuyAmount, places replenishment order
**And** `get_buffer_balance(asset)` returns current balance
**And** `fill_from_buffer(order)` attempts buffer fill, returns success/fail
**And** `replenish_buffer(asset, amount)` queues replenishment
**And** unit tests verify debt accumulation and replenishment trigger

---

### Story 4.6: Limit Order Enforcer

As an **AP**,
I want **to enforce limit prices on all orders**,
So that **users always get price protection**.

**Acceptance Criteria:**

**Given** architecture.md Section 16 (AP Accountability)
**When** I implement limit order enforcer
**Then** `validate_fill(order, fillPrice)` returns pass/fail
**And** for BUY: fillPrice must be ≤ limitPrice
**And** for SELL: fillPrice must be ≥ limitPrice
**And** tolerance of 0.1% allowed (per architecture)
**And** violations logged with full details
**And** `get_violation_count(timeWindow)` returns recent violations
**And** 3 violations in 24h triggers alert
**And** unit tests verify validation logic with edge cases

---

### Story 4.7: Timeout Handler

As an **AP**,
I want **to handle order timeouts gracefully**,
So that **stuck orders don't block the queue**.

**Acceptance Criteria:**

**Given** architecture.md Section 16 (AP Accountability)
**When** I implement timeout handling
**Then** orders timeout after 60 seconds if not filled
**And** timed out orders moved to retry queue
**And** max 3 retries per order
**And** after 3 retries, order marked as failed
**And** failed orders logged for investigation
**And** `get_timeout_count(timeWindow)` returns recent timeouts
**And** timeout metrics exposed for monitoring
**And** unit tests verify timeout detection and retry logic

---

### Story 4.8: Mock Bitget Client

As an **AP developer**,
I want **a mock Bitget client for testing**,
So that **I can develop without real exchange access**.

**Acceptance Criteria:**

**Given** APClient trait from Epic 1
**When** I implement MockBitget
**Then** `place_order(pair, side, amount, price)` simulates order placement
**And** simulated order book with configurable spread
**And** orders fill at configured latency (default 100ms)
**And** `get_fills(orderId)` returns simulated fill data
**And** `get_order_status(orderId)` returns order status
**And** failure injection: `set_failure_rate(rate)` causes random failures
**And** latency injection: `set_latency(ms)` adds delay
**And** unit tests verify mock behavior matches expected

---

### Story 4.9: AP Metrics & Health

As an **AP operator**,
I want **metrics and health reporting**,
So that **I can monitor AP performance**.

**Acceptance Criteria:**

**Given** all AP components from Stories 4.1-4.8
**When** I implement metrics
**Then** exposes: orders_processed, orders_failed, queue_depth, avg_fill_time
**And** exposes: buffer_balance_usd, violations_24h, timeouts_24h
**And** health endpoint returns: status (healthy/degraded/unhealthy)
**And** degraded if: queue_depth > 100 or violations > 0
**And** unhealthy if: queue_depth > 500 or violations > 3
**And** metrics in Prometheus format on /metrics endpoint
**And** JSON health on /health endpoint
**And** unit tests verify metric calculations

---

## Epic 5: External Integrations

All third-party integrations working in isolation.

### Story 5.1: Bitget API Client - Order Placement

As an **AP**,
I want **to place orders on Bitget**,
So that **user orders execute on the exchange**.

**Acceptance Criteria:**

**Given** Bitget API documentation
**When** I implement order placement client
**Then** `authenticate(apiKey, apiSecret)` sets up authentication
**And** `place_limit_order(pair, side, amount, price)` places limit order
**And** returns Bitget order ID on success
**And** handles API errors with appropriate error types
**And** request signing per Bitget specification (HMAC-SHA256)
**And** supports testnet and mainnet endpoints
**And** integration test against Bitget testnet (manual run)
**And** unit tests with mocked HTTP responses

---

### Story 5.2: Bitget API Client - Read-Only

As an **issuer**,
I want **to verify fills via Bitget read-only API**,
So that **I can confirm AP executed orders correctly**.

**Acceptance Criteria:**

**Given** Bitget API documentation
**When** I implement read-only client
**Then** `get_order(orderId)` returns order details
**And** `get_fills(orderId)` returns fill history
**And** `get_order_history(pair, since)` returns recent orders
**And** `get_ticker(pair)` returns current price
**And** read-only API key (no trading permissions)
**And** handles rate limits gracefully
**And** unit tests with mocked HTTP responses

---

### Story 5.3: Bitget Rate Limiter

As an **AP**,
I want **rate limiting for Bitget API calls**,
So that **I don't get blocked by the exchange**.

**Acceptance Criteria:**

**Given** Bitget rate limits (10 orders/sec per architecture)
**When** I implement rate limiter
**Then** `acquire()` blocks until rate limit allows
**And** sliding window algorithm (not fixed buckets)
**And** separate limits for order placement vs read APIs
**And** `get_remaining()` returns remaining capacity
**And** metrics: requests_throttled, avg_wait_time
**And** configurable limits (for different API tiers)
**And** unit tests verify throttling behavior

---

### Story 5.4: 1inch Quote API Client

As an **issuer**,
I want **to fetch swap quotes from 1inch**,
So that **I can determine DEX execution prices**.

**Acceptance Criteria:**

**Given** 1inch API documentation
**When** I implement quote client
**Then** `get_quote(fromToken, toToken, amount, chain)` returns quote
**And** quote includes: toAmount, estimatedGas, protocols used
**And** supports multiple chains: Arbitrum, Ethereum, Base, Optimism
**And** API key authentication
**And** handles API errors gracefully
**And** unit tests with mocked HTTP responses

---

### Story 5.5: 1inch Quote Cache

As an **issuer**,
I want **cached quotes to reduce API calls**,
So that **I don't hit rate limits**.

**Acceptance Criteria:**

**Given** 1inch quote client from Story 5.4
**When** I implement quote cache
**Then** quotes cached for 5 seconds (configurable)
**And** cache key: (fromToken, toToken, amount, chain)
**And** `get_quote_cached()` returns cached or fetches fresh
**And** cache hit/miss metrics exposed
**And** cache reduces API calls by 60-80% in typical usage
**And** unit tests verify cache behavior and expiry

---

### Story 5.6: 1inch Swap Calldata Builder

As an **issuer**,
I want **to build swap calldata for BLSCustody execution**,
So that **swaps can be executed on-chain**.

**Acceptance Criteria:**

**Given** 1inch API documentation
**When** I implement calldata builder
**Then** `build_swap(fromToken, toToken, amount, minReturn, recipient)` returns calldata
**And** calldata compatible with 1inch Aggregation Router V6
**And** includes slippage protection via minReturn
**And** `encode_for_custody(calldata)` wraps for BLSCustody.execute()
**And** supports partial fills
**And** unit tests verify calldata encoding

---

### Story 5.7: 1inch Fusion+ Client

As an **issuer**,
I want **to execute cross-chain swaps via Fusion+**,
So that **assets on other chains can be acquired**.

**Acceptance Criteria:**

**Given** 1inch Fusion+ API documentation
**When** I implement Fusion+ client
**Then** `create_intent(fromChain, toChain, fromToken, toToken, amount)` creates intent
**And** `get_intent_status(intentId)` returns settlement status
**And** supports chains: Arbitrum → Ethereum, Base, Optimism, Solana
**And** intent includes deadline and minReturn
**And** handles resolver matching and settlement
**And** unit tests with mocked responses

---

### Story 5.8: 1inch Rate Limit Handler

As an **issuer**,
I want **robust rate limit handling for 1inch APIs**,
So that **the system degrades gracefully under load**.

**Acceptance Criteria:**

**Given** 1inch quote client from Story 5.4
**When** I implement rate limit handler
**Then** multiple API keys rotated (one per issuer)
**And** exponential backoff on 429 responses (1s, 2s, 4s, 8s, 16s)
**And** max 5 retries before fallback
**And** `get_healthy_key()` returns least-loaded key
**And** metrics: rate_limits_hit, retries, fallbacks
**And** unit tests verify backoff timing

---

### Story 5.9: On-Chain Fallback (Uniswap Reserves)

As an **issuer**,
I want **fallback pricing from on-chain reserves**,
So that **pricing continues if 1inch API is unavailable**.

**Acceptance Criteria:**

**Given** 1inch API unavailable
**When** I implement on-chain fallback
**Then** `get_quote_onchain(pair, amount)` reads Uniswap V3 pool
**And** calculates price from sqrtPriceX96
**And** supports Uniswap V3, Sushiswap on Arbitrum
**And** flags quotes as "DEGRADED_QUOTES" when using fallback
**And** higher latency acceptable (1-2s vs 100ms)
**And** unit tests verify price calculation from reserves

---

### Story 5.10: Squads v4 SDK Integration

As an **issuer**,
I want **to interact with Squads multisig on Solana**,
So that **Solana assets can be managed**.

**Acceptance Criteria:**

**Given** Squads v4 documentation
**When** I implement Squads client
**Then** `create_proposal(transaction)` creates multisig proposal
**And** `approve_proposal(proposalId, signature)` adds approval
**And** `execute_proposal(proposalId)` executes after threshold
**And** `get_proposal_status(proposalId)` returns approval count
**And** threshold: 11/20 (matches BLS threshold)
**And** unit tests with mocked Solana RPC

---

### Story 5.11: Ed25519 Key Manager

As an **issuer**,
I want **to manage Ed25519 keys for Solana**,
So that **I can sign Squads proposals**.

**Acceptance Criteria:**

**Given** Solana key requirements
**When** I implement Ed25519 key manager
**Then** `generate_keypair()` creates new Ed25519 keypair
**And** `sign(privateKey, message)` produces signature
**And** `verify(publicKey, message, signature)` verifies
**And** key storage encrypted at rest
**And** separate from BLS keys (different file)
**And** `export_pubkey()` returns Solana-format public key
**And** unit tests verify signing/verification

---

### Story 5.12: Jupiter Aggregator Client

As an **issuer**,
I want **to execute swaps on Solana via Jupiter**,
So that **Solana assets can be traded efficiently**.

**Acceptance Criteria:**

**Given** Jupiter API documentation
**When** I implement Jupiter client
**Then** `get_quote(inputMint, outputMint, amount)` returns quote
**And** `build_swap_tx(quote, userPubkey)` returns transaction
**And** supports all SPL tokens including memecoins
**And** handles Jupiter versioned transactions
**And** `get_route(inputMint, outputMint)` returns best route
**And** unit tests with mocked responses

---

## Epic 6: Integration, Unmocking & Go-Live

Wire everything together, replace mocks, full system works end-to-end.

### Story 6.1: Deploy Contracts to L3 Testnet

As a **developer**,
I want **contracts deployed to Index L3 testnet**,
So that **real chain testing can begin**.

**Acceptance Criteria:**

**Given** all contracts from Epic 2 passing Foundry tests
**When** I deploy to L3 testnet
**Then** Governance.sol deployed as UUPS proxy
**And** Index.sol deployed as UUPS proxy
**And** ITP.sol factory deployed
**And** BLSCustody.sol deployed on L3
**And** L3BridgeCustody.sol deployed
**And** CollateralRegistry.sol deployed
**And** IssuerRegistry.sol deployed with test issuers
**And** deployment script in `scripts/deploy-l3.sh`
**And** contract addresses saved to `deployments/l3-testnet.json`
**And** verified on block explorer

---

### Story 6.2: Wire Issuer to Real Contracts

As an **issuer operator**,
I want **issuer nodes connected to real L3 contracts**,
So that **real chain consensus can be tested**.

**Acceptance Criteria:**

**Given** contracts deployed from Story 6.1 and issuer from Epic 3
**When** I wire issuer to real contracts
**Then** ChainReader reads from real L3 RPC (https://index.rpc.zeeve.net)
**And** ChainWriter submits to real L3
**And** state reconstruction works from real events
**And** BLS signatures verify against on-chain aggregated key
**And** issuer config updated with real contract addresses
**And** 3 test issuers achieve consensus on testnet
**And** integration test: submit order → batch → confirm

---

### Story 6.3: Wire AP to Real Contracts

As an **AP operator**,
I want **AP connected to real L3 contracts**,
So that **real chain order processing can be tested**.

**Acceptance Criteria:**

**Given** contracts deployed from Story 6.1 and AP from Epic 4
**When** I wire AP to real contracts
**Then** event monitor reads TradeRequest from real L3
**And** fill reporter submits to real L3
**And** AP config updated with real contract addresses
**And** integration test: TradeRequest event → mock fill → report
**And** works with MockBitget still (real chain, mock CEX)

---

### Story 6.4: Wire AP to Real Bitget

As an **AP operator**,
I want **AP connected to real Bitget**,
So that **real exchange execution works**.

**Acceptance Criteria:**

**Given** AP from Epic 4 and Bitget client from Epic 5
**When** I wire AP to real Bitget
**Then** replace MockBitget with real Bitget client
**And** API keys configured via environment
**And** testnet mode for initial testing
**And** rate limiter active
**And** integration test: place order → verify fill → report
**And** buffer management works with real balances
**And** mainnet switch via config flag

---

### Story 6.5: Deploy BLSCustody to Arbitrum

As a **deployer**,
I want **BLSCustody deployed on Arbitrum**,
So that **cross-chain swaps can execute**.

**Acceptance Criteria:**

**Given** BLSCustody.sol from Epic 2
**When** I deploy to Arbitrum
**Then** BLSCustody deployed as UUPS proxy on Arbitrum One
**And** same BLS public key as L3 custody
**And** 1inch Aggregation Router V6 whitelisted
**And** USDC token whitelisted for approvals
**And** deployment script in `scripts/deploy-arbitrum.sh`
**And** addresses saved to `deployments/arbitrum.json`
**And** verified on Arbiscan

---

### Story 6.6: Deploy BLSCustody to Other Chains

As a **deployer**,
I want **BLSCustody deployed on Ethereum, Base, Optimism**,
So that **multi-chain custody is complete**.

**Acceptance Criteria:**

**Given** BLSCustody.sol from Epic 2
**When** I deploy to other chains
**Then** BLSCustody deployed on Ethereum mainnet
**And** BLSCustody deployed on Base
**And** BLSCustody deployed on Optimism
**And** same BLS public key on all chains
**And** chain-specific routers whitelisted (1inch, etc.)
**And** deployment scripts per chain
**And** all addresses in `deployments/` directory

---

### Story 6.7: Wire Issuer to 1inch

As an **issuer**,
I want **1inch integration working end-to-end**,
So that **DEX swaps execute via BLSCustody**.

**Acceptance Criteria:**

**Given** issuer from Epic 3 and 1inch clients from Epic 5
**When** I wire issuer to 1inch
**Then** issuer fetches quotes via 1inch API
**And** issuer builds swap calldata
**And** issuer signs custody execution via BLS
**And** swap executes on Arbitrum BLSCustody
**And** integration test: quote → calldata → BLS sign → execute
**And** Fusion+ cross-chain swap to Ethereum works

---

### Story 6.8: Bridge Integration Test (L3↔Arbitrum)

As a **developer**,
I want **bridge working between L3 and Arbitrum**,
So that **USDC can flow for swaps**.

**Acceptance Criteria:**

**Given** L3BridgeCustody and ArbBridgeCustody deployed
**When** I test bridge flow
**Then** L3→Arb: lock on L3, verify, release on Arb
**And** Arb→L3: lock on Arb, verify, release on L3
**And** timeout reversal works (1 hour, 15/20 threshold)
**And** nonce tracking prevents replay
**And** CollateralRegistry updated correctly
**And** integration test covers both directions

---

### Story 6.9: Squads Integration Test

As an **issuer**,
I want **Squads multisig working on Solana**,
So that **Solana assets can be managed**.

**Acceptance Criteria:**

**Given** Squads client from Epic 5
**When** I test Squads integration
**Then** create Squads vault with 20 issuer pubkeys
**And** threshold set to 11/20
**And** proposal creation works
**And** 11 issuers approve → execution succeeds
**And** 10 issuers approve → execution fails
**And** Jupiter swap via Squads works
**And** integration test on Solana devnet

---

### Story 6.10: E2E Test - Order to Mint

As a **user**,
I want **complete order-to-mint flow working**,
So that **I can buy ITPs end-to-end**.

**Acceptance Criteria:**

**Given** all components wired from Stories 6.1-6.4
**When** I execute full E2E test
**Then** user submits order on L3
**And** issuers batch and sign
**And** TradeRequest emitted
**And** AP executes on Bitget (testnet)
**And** issuers verify fill via Bitget API
**And** issuers confirm fill on-chain
**And** ITP tokens minted to user
**And** E2E test script in `scripts/e2e-order-mint.sh`
**And** test completes in <30 seconds

---

### Story 6.11: E2E Test - Rebalance Flow

As an **asset manager**,
I want **rebalance flow working end-to-end**,
So that **ITP weights can be adjusted**.

**Acceptance Criteria:**

**Given** E2E order flow from Story 6.10
**When** I execute rebalance test
**Then** asset manager proposes rebalance (new weights)
**And** issuers approve via BLS
**And** net trades calculated across ITPs
**And** trades execute via AP
**And** weights updated on-chain
**And** E2E test script in `scripts/e2e-rebalance.sh`
**And** covers: single ITP rebalance, multi-ITP netting

---

### Story 6.12: E2E Test - Cross-Chain Buy

As a **user on Arbitrum**,
I want **to buy ITPs without bridging to L3 first**,
So that **I have better UX**.

**Acceptance Criteria:**

**Given** ArbBridgeCustody with buyITPFromArbitrum
**When** I execute cross-chain buy test
**Then** user calls buyITPFromArbitrum on Arbitrum
**And** USDC locked in Arbitrum custody
**And** CrossChainBuyRequest event emitted
**And** issuers process as normal order
**And** ITP minted on L3 to user address
**And** E2E test script in `scripts/e2e-crosschain-buy.sh`

---

### Story 6.13: Monitoring Dashboard Setup

As an **operator**,
I want **a monitoring dashboard**,
So that **I can observe system health**.

**Acceptance Criteria:**

**Given** metrics from issuer (Epic 3) and AP (Epic 4)
**When** I set up monitoring
**Then** Grafana dashboard with key metrics
**And** panels: orders/sec, queue depth, fill time, consensus time
**And** panels: issuer health, AP health, buffer balance
**And** alerts configured per NFR15-17 thresholds
**And** dashboard JSON in `monitoring/grafana/`
**And** Prometheus config in `monitoring/prometheus/`
**And** docker-compose for monitoring stack

---

### Story 6.14: Logging Infrastructure

As an **operator**,
I want **structured logging across all components**,
So that **I can debug issues**.

**Acceptance Criteria:**

**Given** architecture.md Section 21 (Log Specification)
**When** I implement logging
**Then** all logs in JSON format
**And** required fields: timestamp, level, cycle_number, issuer_id, order_id, itp_id, message
**And** log levels: ERROR, WARN, INFO, DEBUG
**And** log rotation configured
**And** retention: ERROR/WARN 90 days, INFO 30 days, DEBUG 7 days
**And** centralized logging via Loki or similar
**And** log aggregation in `monitoring/loki/`

---

### Story 6.15: Error Handling Audit

As a **developer**,
I want **consistent error handling across all components**,
So that **errors are actionable**.

**Acceptance Criteria:**

**Given** error codes from Epic 1
**When** I audit error handling
**Then** all contracts use ErrorsLib custom errors
**And** all Rust code uses typed errors with codes
**And** error codes appear in logs and events
**And** user-facing errors include code and message
**And** internal errors include stack trace (DEBUG only)
**And** error documentation in `docs/error-codes.md`
**And** audit checklist completed for all components

---

### Story 6.16: Multi-Node Consensus Validation (3 Nodes)

As a **developer**,
I want **3 issuer nodes running real P2P consensus on testnet**,
So that **I can prove leader election, BLS aggregation, and fault tolerance work outside mocks**.

**Acceptance Criteria:**

**Given** issuer nodes wired to real contracts (Story 6.2) and all contracts deployed on a single testnet chain simulating multi-chain
**When** I spin up 3 issuer nodes with distinct BLS keypairs
**Then** nodes discover each other via on-chain IssuerRegistry and establish TLS P2P connections
**And** leader election produces a deterministic leader per cycle via `hash(lastBLSSignature) mod 3`
**And** leader broadcasts PRICE_PROPOSAL and followers respond with PRICE_VOTE
**And** if 1 follower disagrees on price, leader retries with fresh prices (verify retry path)
**And** leader broadcasts BATCH_PROPOSAL and collects BATCH_SIGN from 2/3 nodes (threshold met)
**And** leader aggregates BLS signatures and submits on-chain, contract verifies aggregated signature
**And** test scenario: kill 1 node mid-cycle, verify remaining 2 still reach consensus (2/3 threshold)
**And** test scenario: restart killed node, verify state reconstruction from chain events and node rejoins consensus
**And** all 3 nodes agree on cycle number, pending orders, and collateral state after 10 consecutive cycles
**And** consensus timing stays under 500ms WARNING threshold per NFR16
**And** test script in `scripts/e2e-consensus-3nodes.sh`

---

### Story 6.17: Inventory Rebalancing with Bitget Settlement

As an **asset manager**,
I want **rebalancing to execute the full collateral flow: bridge from L3 custody → Arbitrum custody → Bitget deposit → trade → verify fills → update weights**,
So that **ITP weights actually change and inventory on Bitget reflects the new allocation**.

**Acceptance Criteria:**

**Given** 3 issuer nodes running consensus (Story 6.16), AP wired to mock Bitget, contracts deployed on single testnet chain simulating L3 + Arbitrum with bridge contracts
**When** asset manager proposes new weights for an ITP (e.g., BTC 50%→30%, ETH 30%→50%)
**Then** issuers vote to approve rebalance via BLS consensus
**And** netting engine calculates net trades (sell $20k BTC, buy $20k ETH)
**And** inventory check determines collateral must bridge from L3 custody to Arbitrum custody
**And** L3BridgeCustody.initiateBridge locks USDC with BLS signature
**And** ArbBridgeCustody.completeBridge releases USDC after lock verification
**And** CollateralRegistry updated with bridge movement (L3 → Arbitrum)
**And** TradeRequest event emitted for AP
**And** AP receives TradeRequest, executes sell BTC + buy ETH on mock Bitget
**And** issuers verify fills via mock Bitget read-only API (no direct AP communication per FR13)
**And** issuers confirm fills on-chain with BLS signature
**And** ITP weights updated on-chain to new values
**And** CollateralRegistry reflects new per-chain per-asset balances
**And** test covers multi-ITP netting: 2 ITPs rebalancing opposite directions, verify net trade volume is reduced
**And** test covers bridge netting: opposite-direction bridges net out
**And** test script in `scripts/e2e-rebalance-inventory.sh`

---

### Story 6.18: Full System E2E (3 Nodes + Live AP + Mock Bitget)

As a **developer**,
I want **a complete system integration test with 3 issuer nodes, 1 AP, mock Bitget, and real bridge contracts all running simultaneously**,
So that **the entire system is proven to work as a cohesive unit before going to mainnet**.

**Acceptance Criteria:**

**Given** all contracts deployed on single testnet chain simulating L3 + Arbitrum, 3 issuer nodes running consensus, 1 AP with mock Bitget, bridge contracts deployed
**When** I run the full E2E test suite
**Then** **Phase 1 - Order to Mint:**
**And** user submits buy order for ITP on L3 contracts
**And** 3 issuers achieve consensus on batch (leader election + BLS aggregation)
**And** inventory check passes (sufficient custody balance on Arbitrum)
**And** TradeRequest emitted, AP picks up and executes on mock Bitget
**And** issuers verify fill via mock Bitget read-only API
**And** issuers confirm fill on-chain, ITP tokens minted to user
**And** **Phase 2 - Rebalance with Bridge:**
**And** asset manager proposes rebalance (weight change)
**And** issuers approve, netting engine calculates net trades
**And** collateral bridges L3 → Arbitrum (lock → verify → release)
**And** AP executes rebalance trades on mock Bitget
**And** fills verified and confirmed, weights updated on-chain
**And** CollateralRegistry consistent across all movements
**And** **Phase 3 - Fault Tolerance:**
**And** kill 1 issuer node, submit new order, verify 2/3 consensus still processes it
**And** restart node, verify it reconstructs state and rejoins
**And** **Phase 4 - Cross-Chain Buy:**
**And** user calls buyITPFromArbitrum, USDC locked in Arbitrum custody
**And** issuers process as normal order, ITP minted on L3
**And** all phases run sequentially in a single test run
**And** test script in `scripts/e2e-full-system.sh`
**And** all logs aggregated to `logs/e2e-full/` with JSON structured logging

---

### Epic 8: ITP-Morpho Lending Protocol
Enable ITP holders to borrow USDC against their tokens on Morpho Blue, USDC lenders to earn yield, permissionless BLS-verified oracle and liquidation, with full E2E test and frontend integration matching vital-test pattern.

**FRs covered:** FR-M1 through FR-M16
**NFRs covered:** NFR-M1 through NFR-M7
**Dependencies:** Epics 1-7 (vital-test infrastructure running)

**Phases (5 phases, 17 stories):**
- Phase 1: Registry Sync Infrastructure (8.1-8.4) — IssuerRegistry state events, MirrorIssuerRegistry, issuer HTTP endpoints
- Phase 2: Core Morpho Deployment (8.5-8.9) — Fork Morpho, ITPNAVOracle, market creation, borrow/repay flows
- Phase 3: Liquidation (8.10-8.12) — Oracle BLS collector, partial liquidation loop, permissionless liquidation
- Phase 4: Curator Service (8.13-8.14) — Allocation bot, health monitor
- Phase 5: E2E + Frontend (8.15-8.17) — Deploy script, full E2E test, frontend borrowing/lending check

### Epic 8 FR Coverage Map

| FR | Story | Description |
|----|-------|-------------|
| FR-M1 | 8.6 | ITPNAVOracle with BLS-verified pricing |
| FR-M2 | 8.2 | MirrorIssuerRegistry synced from L3 |
| FR-M3 | 8.1 | RegistryStateChanged event on L3 IssuerRegistry |
| FR-M4 | 8.3 | Issuer nav-sign endpoint |
| FR-M5 | 8.4 | Issuer registry-sync endpoint |
| FR-M6 | 8.5 | Fork Morpho Blue + MetaMorpho |
| FR-M7 | 8.7 | Create Morpho Blue market per ITP |
| FR-M8 | 8.7 | MetaMorpho USDC vault with curator roles |
| FR-M9 | 8.8 | Deposit ITP, borrow USDC |
| FR-M10 | 8.9 | Repay USDC, withdraw ITP |
| FR-M11 | 8.10 | Curator pushes BLS-verified NAV |
| FR-M12 | 8.11 | Iterative partial liquidation |
| FR-M13 | 8.12 | Permissionless liquidation |
| FR-M14 | 8.7 | USDC lenders deposit into vault |
| FR-M15 | 8.13 | Allocation bot |
| FR-M16 | 8.17 | Frontend integration check |

---

## Epic 8: ITP-Morpho Lending Protocol — Requirements

### Morpho Lending Functional Requirements

FR-M1: Deploy ITPNAVOracle with BLS-verified NAV pricing (permissionless `updatePrice`)
FR-M2: Deploy MirrorIssuerRegistry on Arbitrum synced from L3 IssuerRegistry via BLS proofs
FR-M3: Add `RegistryStateChanged` event + `_emitStateChange()` to L3 IssuerRegistry
FR-M4: Issuer nodes expose `GET /api/nav-sign` endpoint (BLS-signed NAV per ITP)
FR-M5: Issuer nodes expose `GET /api/registry-sync` endpoint (BLS-signed registry state)
FR-M6: Fork Morpho Blue + MetaMorpho to local anvil (alongside vital-test contracts)
FR-M7: Create Morpho Blue market per ITP (ITP collateral / USDC loan token)
FR-M8: Deploy MetaMorpho USDC vault with curator roles (owner, curator, allocator)
FR-M9: Users can deposit ITP as collateral and borrow USDC on Morpho
FR-M10: Users can repay USDC debt and withdraw ITP collateral
FR-M11: Curator pushes BLS-verified NAV prices to oracle (permissionless — anyone can push)
FR-M12: Iterative partial liquidation: seize ITP → sell via BridgeProxy → recover USDC → repeat
FR-M13: Any liquidator can independently refresh oracle + liquidate (no curator dependency)
FR-M14: USDC lenders can deposit into MetaMorpho vault for yield
FR-M15: Curator allocation bot distributes vault USDC across ITP markets
FR-M16: Frontend integration: borrowing/lending UI check

### Morpho Lending Non-Functional Requirements

NFR-M1: Oracle MAX_STALENESS: 3-24 hours depending on ITP risk tier
NFR-M2: Oracle price in 36 decimals (Morpho standard)
NFR-M3: Cycle number monotonically increasing for oracle updates
NFR-M4: MetaMorpho vault timelock: 24 hours for cap changes
NFR-M5: LLTV range: 50-82% based on ITP risk tier
NFR-M6: Test environment follows vital-test pattern (single anvil, no cross-chain complexity)
NFR-M7: E2E test with real BLS signatures (no mocking), matching vital-test approach

### Additional Requirements (Morpho)

- Mirror registry bootstrap: initial deploy copies L3 IssuerRegistry state
- Old keys sign transition to new keys (chain of trust for MirrorIssuerRegistry sync)
- Liquidation bot needs seed USDC capital for partial liquidation loop
- Bridge sell round-trip latency affects liquidation iteration strategy
- Test framework modeled on vital-test.md: 3 issuers, AP, and frontend live — no virtual E2E
- Frontend integration check for borrowing/lending flows (deposit collateral, borrow, repay, withdraw)
- Morpho Blue and MetaMorpho forked (not custom) — use official contracts
- AdaptiveIRM (interest rate model) deployed alongside Morpho
- One ITPNAVOracle instance per ITP market
- BLSLib shared with existing deployment for BLS signature verification

---

## Epic 8: ITP-Morpho Lending Protocol

Enable ITP holders to borrow USDC against their tokens on Morpho Blue, USDC lenders to earn yield, permissionless BLS-verified oracle and liquidation, with full E2E test and frontend integration matching vital-test pattern.

**FRs covered:** FR-M1 through FR-M16
**NFRs covered:** NFR-M1 through NFR-M7
**Dependencies:** Epics 1-7 (vital-test infrastructure running)

### Story 8.1: IssuerRegistry State Change Events

As an **issuer network operator**,
I want **the L3 IssuerRegistry to emit state change events with a monotonic nonce on every mutation**,
So that **observers can detect registry changes and produce BLS-signed sync proofs for cross-chain mirroring**.

**Acceptance Criteria:**

**Given** the L3 IssuerRegistry contract is deployed
**When** `addIssuer()` is called successfully
**Then** `_registryNonce` is incremented by 1
**And** `RegistryStateChanged(nonce, activeCount, stateHash)` event is emitted
**And** `stateHash` equals `keccak256` of all active issuer pubkeys packed in order

**Given** the L3 IssuerRegistry contract is deployed
**When** `removeIssuer()` is called successfully
**Then** `_registryNonce` is incremented by 1
**And** `RegistryStateChanged` event is emitted with updated `activeCount` and `stateHash`

**Given** the L3 IssuerRegistry contract is deployed
**When** `executeRotation()` completes a key rotation
**Then** `_registryNonce` is incremented by 1
**And** `RegistryStateChanged` event is emitted with updated `stateHash` reflecting new key

**Given** the L3 IssuerRegistry contract is deployed
**When** `registryNonce()` is called
**Then** the current monotonically increasing nonce value is returned

**Given** the L3 IssuerRegistry contract is deployed
**When** `getRegistryStateHash()` is called
**Then** a `bytes32` hash of all active issuer BLS pubkeys is returned
**And** the hash is deterministic and reproducible from on-chain state

---

### Story 8.2: MirrorIssuerRegistry Contract

As a **Morpho oracle contract**,
I want **a MirrorIssuerRegistry on Arbitrum (local anvil) that stays in sync with the L3 IssuerRegistry via BLS-signed proofs**,
So that **BLS signature verification for NAV oracle updates can reference the current issuer set without cross-chain calls**.

**Acceptance Criteria:**

**Given** the MirrorIssuerRegistry proxy is deployed with initial state matching L3 IssuerRegistry
**When** `initialize(aggPubkey, threshold, activeCount, admin)` is called
**Then** the contract stores the initial aggregated G2 pubkey (128 bytes), threshold, activeCount, and registryNonce=0

**Given** an initialized MirrorIssuerRegistry
**When** `sync(newAggPubkey, newActiveCount, newThreshold, nonce, blsSignature, signersBitmask)` is called with a valid BLS signature from the CURRENT issuer set
**Then** the aggregated pubkey, threshold, activeCount, and registryNonce are updated
**And** `RegistrySynced(nonce, activeCount, threshold)` event is emitted

**Given** an initialized MirrorIssuerRegistry with registryNonce=5
**When** `sync()` is called with nonce=5 or nonce=3
**Then** the transaction reverts with `StaleNonce(provided, current)`

**Given** an initialized MirrorIssuerRegistry
**When** `sync()` is called with an invalid BLS signature (wrong keys, tampered data)
**Then** the transaction reverts with `InvalidBLSSignature()`

**Given** an initialized MirrorIssuerRegistry
**When** `sync()` is called with `newAggPubkey` not exactly 128 bytes
**Then** the transaction reverts with `InvalidAggPubkey()`

**Given** an initialized MirrorIssuerRegistry
**When** `getAggregatedPubkey()` is called by the ITPNAVOracle
**Then** the current aggregated G2 pubkey bytes are returned

**Given** Foundry test environment
**When** MirrorIssuerRegistry is deployed alongside L3 IssuerRegistry
**Then** a test proves: add issuer on L3 → collect BLS sync proofs → call `sync()` on mirror → verify updated state matches

---

### Story 8.3: Issuer NAV Signing Endpoint

As a **curator or liquidator**,
I want **each issuer node to expose a `GET /api/nav-sign?itp={address}` HTTP endpoint that returns a BLS-signed NAV price**,
So that **anyone can collect NAV signatures from 2/3 of issuers and push a verified price to the oracle contract**.

**Acceptance Criteria:**

**Given** an issuer node is running and has BLS keys registered
**When** `GET /api/nav-sign?itp=0x...` is called with a valid ITP address
**Then** the issuer computes the current NAV for the ITP
**And** returns JSON: `{ itpAddress, price (36 decimals), timestamp, cycleNumber, blsSignature (G1 point), issuerId, pubkey (G2) }`

**Given** an issuer node is running
**When** `GET /api/nav-sign?itp=0xINVALID` is called with an unknown ITP address
**Then** the endpoint returns HTTP 404 with error message

**Given** an issuer node is running
**When** two concurrent `GET /api/nav-sign` requests arrive for the same ITP
**Then** both return consistent NAV data (same price and cycleNumber for the same cycle)

**Given** 3 issuer nodes running in the local test environment
**When** a test client calls `GET /api/nav-sign?itp=0x...` on all 3 issuers
**Then** all 3 return the same price and cycleNumber
**And** individual BLS signatures can be aggregated into a valid aggregate signature
**And** the aggregate signature verifies against the IssuerRegistry aggregated pubkey

**Given** the endpoint is public (no authentication)
**When** any external caller requests NAV signing
**Then** the response is returned without authentication
**And** the individual BLS signature alone cannot be used to update the oracle (needs 2/3 threshold)

---

### Story 8.4: Issuer Registry Sync Endpoint

As a **registry sync operator (anyone)**,
I want **each issuer node to expose a `GET /api/registry-sync` HTTP endpoint that returns a BLS-signed registry state proof**,
So that **anyone can collect sync proofs and push registry updates to the MirrorIssuerRegistry on Arbitrum**.

**Acceptance Criteria:**

**Given** an issuer node is running and has observed a `RegistryStateChanged` event on L3
**When** `GET /api/registry-sync` is called
**Then** the issuer returns JSON: `{ nonce, aggregatedPubkey (new G2), activeCount, threshold, stateHash, blsSignature, issuerId }`
**And** the BLS signature is over `keccak256(abi.encode("REGISTRY_SYNC", nonce, newAggPubkey, activeCount, threshold))`

**Given** an issuer node is running but no `RegistryStateChanged` event has been emitted yet
**When** `GET /api/registry-sync` is called
**Then** the endpoint returns HTTP 404 or a response indicating no sync data available

**Given** 3 issuer nodes in local test environment
**When** an issuer is added on L3 (triggering `RegistryStateChanged`)
**Then** all 3 issuers detect the event, compute the new aggregated G2 pubkey off-chain
**And** each issuer caches the BLS-signed sync proof
**And** a test client can collect 2/3 proofs, aggregate, and successfully call `MirrorIssuerRegistry.sync()`

**Given** the registry sync endpoint
**When** a new `RegistryStateChanged` event occurs with a higher nonce
**Then** the issuer updates its cached sync proof to reflect the latest state
**And** subsequent requests return the updated proof

---

### Story 8.5: Fork Morpho Blue + MetaMorpho to Local Anvil

As a **developer**,
I want **Morpho Blue and MetaMorpho contracts forked and deployed on the local anvil chain alongside the existing vital-test contracts**,
So that **lending/borrowing functionality can be tested in the same environment as the Index protocol without cross-chain complexity**.

**Acceptance Criteria:**

**Given** the local anvil chain is running with vital-test contracts deployed (Index, BridgeProxy, IssuerRegistry, etc.)
**When** the Morpho deployment script runs
**Then** Morpho Blue core (`Morpho.sol`) is deployed on the "Mock Arbitrum" side of the local anvil
**And** MetaMorpho vault factory is deployed
**And** AdaptiveIRM (interest rate model) is deployed
**And** all Morpho contract addresses are written to a deployment JSON file

**Given** Morpho Blue is deployed on local anvil
**When** `Morpho.createMarket()` is called with valid market parameters
**Then** a new lending market is created successfully
**And** the market ID can be queried

**Given** MetaMorpho factory is deployed
**When** a new vault is created via the factory with USDC as the asset
**Then** the vault is deployed with ERC4626 interface
**And** the vault accepts USDC deposits

**Given** the deployment script
**When** it runs after `local-e2e-deploy.sh` (vital-test setup)
**Then** it does not conflict with existing contracts
**And** it references existing ArbUSDC (MockERC20) as the loan token
**And** it references existing ITP vault tokens as collateral
**And** a `deployments/morpho-e2e.json` file is created with all addresses

**Given** Foundry test environment
**When** Morpho Blue + MetaMorpho are imported as dependencies
**Then** `forge build` compiles without errors
**And** existing vital-test Foundry tests still pass

---

### Story 8.6: ITPNAVOracle Contract

As a **Morpho Blue market**,
I want **a BLS-verified ITP NAV oracle that reads the issuer set from MirrorIssuerRegistry and accepts permissionless price updates**,
So that **ITP collateral is priced accurately using BLS-verified consensus from the issuer network**.

**Acceptance Criteria:**

**Given** ITPNAVOracle is deployed with references to MirrorIssuerRegistry, BLSLib, and a specific ITP address
**When** `updatePrice(newPrice, timestamp, cycleNumber, blsSignature, signersBitmask)` is called with a valid aggregated BLS signature from 2/3 of issuers
**Then** `currentPrice` is updated to `newPrice`
**And** `lastUpdated` is set to `block.timestamp`
**And** `lastCycleNumber` is updated
**And** `PriceUpdated(price, timestamp, cycleNumber)` event is emitted

**Given** ITPNAVOracle with `lastCycleNumber = 42`
**When** `updatePrice()` is called with `cycleNumber = 42` or `cycleNumber = 41`
**Then** the transaction reverts with `StaleCycleNumber()`

**Given** ITPNAVOracle
**When** `updatePrice()` is called with `newPrice = 0`
**Then** the transaction reverts with `InvalidPrice()`

**Given** ITPNAVOracle
**When** `updatePrice()` is called with an invalid BLS signature (wrong signers, tampered price)
**Then** the transaction reverts with `InvalidBLSSignature()`

**Given** ITPNAVOracle with a price updated 2 hours ago and `MAX_STALENESS = 24 hours`
**When** Morpho Blue calls `price()`
**Then** the current price is returned in 36-decimal format

**Given** ITPNAVOracle with a price updated 25 hours ago and `MAX_STALENESS = 24 hours`
**When** `price()` is called
**Then** the transaction reverts with `StalePriceError()`

**Given** ITPNAVOracle deployed on local anvil
**When** any address (not just curator) calls `updatePrice()` with valid BLS signature
**Then** the update succeeds — the function is fully permissionless

**Given** Foundry test environment with 3 issuers, IssuerRegistry, MirrorIssuerRegistry, and BLSLib deployed
**When** a test collects BLS-signed NAV from issuers, aggregates, and pushes to ITPNAVOracle
**Then** the oracle accepts the update and returns the correct price via `price()`

---

### Story 8.7: Create Morpho Market + MetaMorpho Vault

As a **curator**,
I want **a Morpho Blue market created for ITP/USDC and a MetaMorpho USDC vault configured with curator roles**,
So that **users can borrow USDC against ITP collateral and lenders can deposit USDC for yield**.

**Acceptance Criteria:**

**Given** Morpho Blue, MetaMorpho, ITPNAVOracle, and AdaptiveIRM are deployed
**When** `Morpho.createMarket(MarketParams)` is called with collateral=ITP, loanToken=USDC, oracle=ITPNAVOracle, irm=AdaptiveIRM, lltv=77%
**Then** a Morpho Blue market is created
**And** the market ID is deterministic from MarketParams

**Given** MetaMorpho factory is deployed
**When** a vault is created with asset=USDC, name="Index ITP Lending Vault", symbol="ilUSDC", owner=curatorMultisig, timelock=24 hours
**Then** the vault is deployed with correct parameters
**And** curator address is set
**And** allocator address is set (curator bot)

**Given** a MetaMorpho vault with curator role configured
**When** `vault.submitCap(marketId, cap)` is called by the curator
**Then** the cap submission is accepted and enters the timelock queue

**Given** a submitted cap with 24-hour timelock elapsed
**When** `vault.acceptCap(marketId)` is called
**Then** the market cap is activated
**And** the allocator can now supply vault USDC to this market

**Given** a configured MetaMorpho vault
**When** a USDC lender calls `vault.deposit(amount, lender)` after approving USDC
**Then** USDC is deposited into the vault
**And** vault shares are minted to the lender
**And** the allocator can distribute deposited USDC across approved ITP markets

**Given** the deployment script for Morpho market + vault
**When** it runs on local anvil
**Then** all addresses are appended to `deployments/morpho-e2e.json`
**And** initial oracle price is pushed before market creation
**And** initial USDC liquidity is seeded into the vault for testing

---

### Story 8.8: User Borrow Flow

As an **ITP holder**,
I want **to deposit my ITP tokens as collateral on Morpho Blue and borrow USDC against them**,
So that **I can access liquidity without selling my ITP position**.

**Acceptance Criteria:**

**Given** a Morpho Blue market (ITP/USDC) is live with USDC liquidity in the vault and a fresh oracle price
**When** a user approves Morpho to spend their ITP tokens and calls `morpho.supplyCollateral(marketParams, amount, user, "")`
**Then** ITP tokens are transferred from user to Morpho
**And** the user's collateral balance is recorded in Morpho

**Given** a user has deposited ITP collateral
**When** the user calls `morpho.borrow(marketParams, usdcAmount, 0, user, user)` with an amount within their LLTV allowance
**Then** USDC is transferred from the vault to the user
**And** a borrow position (debt) is recorded for the user
**And** the user's health factor is above 1.0

**Given** a user has deposited ITP collateral
**When** the user attempts to borrow USDC exceeding their LLTV limit
**Then** the transaction reverts (Morpho enforces LLTV)

**Given** a user has an active borrow position
**When** `morpho.position(marketId, user)` is queried
**Then** the collateral amount and borrow shares are returned correctly

**Given** Foundry test environment with full Morpho deployment
**When** a test runs the complete borrow flow: approve ITP → supplyCollateral → borrow USDC
**Then** user ends with USDC in their wallet, ITP locked in Morpho, and debt recorded
**And** the vault's total supply decreased by the borrowed amount

---

### Story 8.9: User Repay Flow

As an **ITP borrower**,
I want **to repay my USDC debt and withdraw my ITP collateral from Morpho Blue**,
So that **I can close my lending position and recover my ITP tokens**.

**Acceptance Criteria:**

**Given** a user has an active borrow position with USDC debt and ITP collateral locked
**When** the user approves Morpho to spend USDC and calls `morpho.repay(marketParams, usdcAmount, 0, user, "")`
**Then** USDC is transferred from user to the vault
**And** the user's debt is reduced by the repaid amount

**Given** a user has fully repaid their USDC debt (borrow shares = 0)
**When** the user calls `morpho.withdrawCollateral(marketParams, itpAmount, user, user)`
**Then** ITP tokens are transferred from Morpho back to the user
**And** the user's collateral balance in Morpho is reduced to 0

**Given** a user has partial debt remaining
**When** the user attempts to withdraw all collateral
**Then** the transaction reverts (health factor would drop below 1.0)

**Given** a user has partial debt remaining
**When** the user withdraws only enough collateral to keep health factor above 1.0
**Then** the withdrawal succeeds and partial collateral is returned

**Given** Foundry test environment
**When** a test runs the complete round-trip: deposit → borrow → repay → withdraw
**Then** the user ends with their original ITP balance restored
**And** the user's USDC balance is reduced by accrued interest
**And** the vault's USDC balance reflects the interest earned

---

### Story 8.10: Oracle BLS Collector

As a **curator bot**,
I want **an off-chain service that requests NAV from each issuer node, collects BLS signatures, aggregates them, and pushes the verified price to the ITPNAVOracle contract**,
So that **Morpho Blue markets always have a fresh, BLS-verified ITP price for collateral valuation**.

**Acceptance Criteria:**

**Given** 3 issuer nodes running with `GET /api/nav-sign` endpoints available
**When** the oracle BLS collector requests NAV for a specific ITP from all 3 issuers
**Then** it receives individual BLS signatures from each issuer
**And** all returned prices and cycleNumbers match (consensus)

**Given** the collector has received BLS signatures from at least 2 of 3 issuers (2/3 threshold)
**When** it aggregates the individual BLS signatures off-chain
**Then** it produces a valid aggregated BLS signature
**And** it computes the correct `signersBitmask` reflecting which issuers signed

**Given** the collector has a valid aggregated BLS signature
**When** it calls `ITPNAVOracle.updatePrice(price, timestamp, cycleNumber, blsSignature, signersBitmask)`
**Then** the on-chain oracle accepts the update
**And** `price()` returns the freshly pushed price

**Given** the collector requests NAV from 3 issuers but only 1 responds
**When** the threshold (2/3) is not met
**Then** the collector logs an error and does not attempt to push to the oracle
**And** it retries after a configurable interval

**Given** the collector receives responses where issuers disagree on price
**When** prices do not match across issuers
**Then** the collector rejects the batch and logs a warning
**And** it does not push a price to the oracle

**Given** the collector is configured with a risk-tier-based update cadence
**When** running in a loop
**Then** it refreshes the oracle at the configured interval (e.g., every 4 hours for Tier A)
**And** it always verifies the new cycleNumber is greater than `lastCycleNumber` on-chain before pushing

**Given** the local E2E test environment
**When** the collector runs against 3 live issuers
**Then** it successfully pushes at least one BLS-verified price update to the oracle
**And** the oracle's `price()` returns the pushed value without reverting

---

### Story 8.11: Partial Liquidation Loop

As a **curator liquidation bot**,
I want **to perform iterative partial liquidations on unhealthy Morpho positions by seizing ITP collateral, selling it via BridgeProxy, and using the recovered USDC to liquidate more**,
So that **the lending protocol remains solvent and bad debt is minimized through a self-funding liquidation cycle**.

**Acceptance Criteria:**

**Given** a Morpho Blue position with health factor below 1.0 (due to NAV price drop)
**When** the liquidation bot calls `morpho.liquidate(marketParams, borrower, seizedAssets, 0, "")` with a partial `seizedAssets` amount
**Then** the bot repays proportional USDC debt
**And** the bot receives the seized ITP tokens plus the liquidation incentive (e.g., 5-12%)

**Given** the bot has seized ITP tokens from a partial liquidation
**When** the bot sells the seized ITP via `BridgeProxy.sell()` (existing sell flow)
**Then** the sell order is processed by issuers (BLS consensus → AP executes → confirmFills)
**And** USDC is returned to the bot

**Given** the bot has recovered USDC from selling seized ITP
**When** the recovered USDC (original repayment + liquidation incentive) is available
**Then** the bot can use this larger USDC amount to liquidate a bigger portion of the same position
**And** the loop continues until the position is healthy or fully liquidated

**Given** a position that requires multiple liquidation iterations
**When** the bot runs the full loop (liquidate → sell → recover → liquidate more)
**Then** the bot's USDC grows by approximately the liquidation incentive percentage each iteration
**And** the position's health factor improves with each iteration

**Given** the bot starts with seed USDC capital
**When** it begins the first iteration
**Then** it approves Morpho to spend its USDC before calling `liquidate()`
**And** it tracks the total USDC spent, ITP seized, and USDC recovered per iteration

**Given** the position becomes healthy (health factor >= 1.0) mid-loop
**When** the bot checks position health after an iteration
**Then** it stops liquidating and logs the final state
**And** no further liquidation calls are made

**Given** the bot attempts to liquidate a position with health factor >= 1.0
**When** `morpho.liquidate()` is called
**Then** the transaction reverts (Morpho enforces health check)
**And** the bot handles the revert gracefully

**Given** Foundry test environment
**When** a test simulates: deposit ITP → borrow USDC → push lower NAV (BLS-signed) → partial liquidate → sell ITP → iterate
**Then** the full liquidation loop executes successfully
**And** the borrower's debt is reduced proportionally
**And** the vault's USDC balance is restored from the sold ITP

---

### Story 8.12: Permissionless Liquidation Test

As a **protocol user or external liquidator**,
I want **to independently perform the full liquidation flow (sync mirror registry → refresh oracle → liquidate) without depending on the curator bot**,
So that **the protocol has no single point of failure for liquidations and positions can always be unwound**.

**Acceptance Criteria:**

**Given** a MirrorIssuerRegistry that is stale (behind L3 IssuerRegistry)
**When** an independent liquidator collects BLS-signed registry sync proofs from issuers via `GET /api/registry-sync`
**Then** the liquidator can aggregate the proofs and call `mirrorRegistry.sync()` successfully
**And** the mirror registry is now up to date

**Given** an ITPNAVOracle with a stale price
**When** an independent liquidator collects BLS-signed NAV from issuers via `GET /api/nav-sign`
**Then** the liquidator can aggregate signatures and call `oracle.updatePrice()` successfully
**And** the oracle reflects the fresh price

**Given** an updated oracle showing a position with health factor < 1.0
**When** the independent liquidator (not the curator) calls `morpho.liquidate()` with their own USDC
**Then** the liquidation succeeds
**And** the liquidator receives seized ITP + liquidation incentive
**And** the liquidator can sell the ITP via BridgeProxy

**Given** local E2E test environment with 3 issuers running
**When** a test script performs the full permissionless flow as a non-curator address:
1. Sync mirror registry (if stale)
2. Push fresh NAV to oracle
3. Partial liquidate on Morpho
4. Sell seized ITP via BridgeProxy
**Then** every step succeeds without any curator involvement
**And** the test proves no access control restricts these operations

**Given** both the curator bot and an independent liquidator attempt to liquidate the same position
**When** the curator liquidates first
**Then** the independent liquidator's subsequent call either succeeds (if position still unhealthy) or reverts gracefully (if position is now healthy)
**And** no race condition causes fund loss

---

### Story 8.13: Allocation Bot

As a **curator**,
I want **an automated allocation bot that monitors vault utilization across ITP markets and rebalances USDC distribution to optimize yield and respect risk limits**,
So that **vault capital is efficiently deployed across ITP markets while maintaining concentration limits per risk tier**.

**Acceptance Criteria:**

**Given** a MetaMorpho vault with USDC deposited and multiple ITP markets approved
**When** the allocation bot queries current utilization per market
**Then** it retrieves supply, borrow, and utilization rate for each market
**And** it identifies markets above or below the target utilization range (70-85%)

**Given** a market with utilization above 85%
**When** the allocation bot runs its rebalancing logic
**Then** it calls `vault.reallocate(allocations)` to shift USDC from lower-utilization markets to the high-utilization market
**And** the reallocation respects the supply cap for each market

**Given** a market with utilization below 70%
**When** the allocation bot runs its rebalancing logic
**Then** it considers withdrawing excess supply from the underutilized market
**And** redirecting it to markets with better risk-adjusted yield

**Given** risk tier caps are configured (Tier A: 30%, Tier B: 20%, Tier C: 10%, Tier D: 5% of total vault)
**When** the allocation bot proposes a reallocation
**Then** no single ITP market exceeds its tier-based concentration limit
**And** the bot logs a warning if a market is approaching its cap

**Given** the allocation bot is running
**When** a new ITP market is added to the vault (cap accepted after timelock)
**Then** the bot includes the new market in its next rebalancing cycle
**And** it allocates an initial supply based on the market's risk tier

**Given** the allocation bot encounters a revert during `reallocate()`
**When** the transaction fails (e.g., insufficient liquidity to withdraw)
**Then** the bot logs the error with market details
**And** retries with a smaller reallocation amount on the next cycle

**Given** the local E2E environment with one ITP market
**When** the allocation bot runs
**Then** it supplies vault USDC to the available market up to its cap
**And** logs all allocation decisions with utilization metrics

---

### Story 8.14: Health Monitor

As a **curator operator**,
I want **an automated health monitor that tracks position health factors, oracle freshness, mirror registry sync status, and vault metrics with configurable alerts**,
So that **the curator can react to risk events before they become critical and ensure the lending protocol operates safely**.

**Acceptance Criteria:**

**Given** the health monitor is running against the Morpho deployment
**When** it scans all open borrow positions on each ITP market
**Then** it calculates the health factor for each position
**And** it identifies positions with health factor below configurable thresholds (e.g., WARNING < 1.2, CRITICAL < 1.05)

**Given** a position with health factor below the CRITICAL threshold (< 1.05)
**When** the health monitor detects it
**Then** it logs an alert with borrower address, collateral amount, debt amount, and current health factor
**And** it triggers the oracle BLS collector to refresh the price immediately (pre-liquidation cadence)

**Given** the ITPNAVOracle has `lastUpdated` older than the risk-tier cadence (e.g., >4 hours for Tier A)
**When** the health monitor checks oracle freshness
**Then** it flags the oracle as stale
**And** logs a warning with time since last update and the configured cadence

**Given** the MirrorIssuerRegistry has `registryNonce` behind the L3 IssuerRegistry nonce
**When** the health monitor checks sync status
**Then** it flags the mirror as out of sync
**And** logs the nonce gap

**Given** the MetaMorpho vault
**When** the health monitor checks vault metrics
**Then** it reports total deposits, total borrows, aggregate utilization, and available liquidity
**And** it flags if overall utilization exceeds 90% (high demand, low liquidity risk)

**Given** the health monitor detects an ITP market where the oracle has been stale beyond `MAX_STALENESS`
**When** new borrows would revert due to stale price
**Then** it logs a CRITICAL alert indicating the market is effectively frozen
**And** recommends immediate oracle refresh or emergency cap reduction

**Given** the local E2E test environment
**When** the health monitor runs a single scan cycle
**Then** it produces a structured JSON report with all position health factors, oracle ages, mirror sync status, and vault metrics
**And** the report is written to a log file

---

### Story 8.15: Morpho E2E Deploy Script

As a **developer**,
I want **a deployment script that deploys all Morpho lending contracts alongside the existing vital-test infrastructure on a single local anvil chain**,
So that **the full lending protocol can be tested end-to-end in the same environment as the Index protocol**.

**Acceptance Criteria:**

**Given** the vital-test infrastructure is running (anvil, 3 issuers, AP, contracts deployed via `local-e2e-deploy.sh`)
**When** `scripts/deploy-morpho-e2e.sh` is executed
**Then** the following contracts are deployed on the local anvil:
- Morpho Blue (forked)
- MetaMorpho vault factory
- AdaptiveIRM
- MirrorIssuerRegistry (initialized with L3 IssuerRegistry state)
- ITPNAVOracle (per ITP, linked to MirrorIssuerRegistry + BLSLib)
- MetaMorpho USDC vault (curator roles configured)
**And** all addresses are saved to `deployments/morpho-e2e.json`

**Given** the deploy script has deployed all Morpho contracts
**When** it completes the setup phase
**Then** an initial BLS-verified NAV price is pushed to the ITPNAVOracle (collected from live issuers)
**And** a Morpho Blue market (ITP/USDC) is created with LLTV=77%
**And** the market is added to the MetaMorpho vault with a supply cap
**And** seed USDC liquidity is deposited into the vault by a test lender

**Given** the deploy script references existing vital-test contracts
**When** it looks up ArbUSDC, ITP vault, IssuerRegistry, and BLSLib addresses
**Then** it reads them from the existing `deployments/local-e2e.json` (or equivalent)
**And** does not redeploy any vital-test contracts

**Given** the deploy script has completed
**When** environment variables are exported
**Then** `MORPHO`, `METAMORPHO_VAULT`, `ITP_ORACLE`, `MIRROR_REGISTRY`, `ADAPTIVE_IRM`, and `MORPHO_MARKET_ID` are all set
**And** subsequent test scripts can reference these variables

**Given** a developer runs the deploy script on a fresh anvil after `local-e2e-deploy.sh`
**When** both scripts complete without errors
**Then** `cast call $ITP_ORACLE "price()"` returns a valid non-zero price
**And** `cast call $METAMORPHO_VAULT "totalAssets()"` returns the seeded USDC amount

---

### Story 8.16: Morpho Lending E2E Test

As a **QA engineer**,
I want **a full end-to-end test that exercises the complete Morpho lending lifecycle: deposit collateral, borrow, NAV price drop, oracle refresh, partial liquidation, ITP sell via BridgeProxy, and iterative liquidation loop**,
So that **the entire lending protocol is validated with real BLS signatures, real issuer consensus, and real bridge flows matching the vital-test pattern**.

**Acceptance Criteria:**

**Given** vital-test infrastructure + Morpho contracts are deployed and running (3 issuers, AP, frontend)
**When** the E2E test script `scripts/morpho-lending-e2e.sh` executes
**Then** it runs the following phases sequentially:

**And** **Phase 1 — Setup & Deposit:**
**And** a test user holds ITP tokens (from a prior buy flow or direct mint)
**And** a test lender has deposited USDC into the MetaMorpho vault
**And** the ITPNAVOracle has a fresh BLS-verified price

**And** **Phase 2 — Borrow:**
**And** user approves Morpho to spend ITP
**And** user calls `supplyCollateral()` — ITP locked in Morpho
**And** user calls `borrow()` — USDC transferred to user
**And** user's health factor is verified > 1.0
**And** user's USDC balance increased by borrowed amount

**And** **Phase 3 — NAV Price Drop (Simulated):**
**And** issuers are instructed to return a lower NAV (or a mock price override is used)
**And** curator/test collects BLS-signed lower NAV from issuers
**And** `oracle.updatePrice()` is called with the lower BLS-verified price
**And** user's health factor drops below 1.0

**And** **Phase 4 — Liquidation:**
**And** liquidation bot (or test script) approves Morpho to spend seed USDC
**And** `morpho.liquidate()` partial — bot repays USDC debt, receives seized ITP + incentive
**And** bot sells seized ITP via BridgeProxy (existing sell flow through issuers)
**And** issuers process: confirmBatch → AP executes → confirmFills
**And** USDC is returned to the bot

**And** **Phase 5 — Iteration & Verification:**
**And** bot uses recovered USDC (larger than seed due to incentive) for a second liquidation iteration
**And** position health improves after liquidation iterations
**And** all Morpho positions, vault balances, and collateral amounts are verified consistent

**And** **Phase 6 — Repay & Withdraw (Clean Position):**
**And** if any debt remains, user repays remaining USDC
**And** user withdraws remaining ITP collateral
**And** final state is verified: no outstanding debt, all ITP returned or seized

**Given** the E2E test completes
**When** results are checked
**Then** all phases completed without reverts
**And** structured JSON logs are written to `logs/morpho-e2e/`
**And** the test script exits with code 0 on success, non-zero on failure

---

### Story 8.17: Frontend Borrowing/Lending Integration Check

As a **product owner**,
I want **the frontend to integrate with the Morpho lending protocol so users can deposit ITP collateral, borrow USDC, repay debt, and withdraw collateral through the UI**,
So that **the lending feature is accessible to end users and validated against the live backend including real BLS-verified oracles**.

**Acceptance Criteria:**

**Given** the frontend is running and connected to the local anvil with Morpho contracts deployed
**When** a user navigates to the lending/borrowing section
**Then** the UI displays available ITP markets with current NAV price, LLTV, utilization, and borrow APY
**And** the data is fetched from on-chain Morpho + oracle contracts

**Given** a user holds ITP tokens in their wallet
**When** the user selects an ITP market and enters a collateral amount to deposit
**Then** the UI prompts for ITP approval (if not already approved)
**And** calls `morpho.supplyCollateral()` on confirmation
**And** the UI updates to show the deposited collateral balance

**Given** a user has deposited ITP collateral
**When** the user enters a USDC amount to borrow (within LLTV limits)
**Then** the UI shows the projected health factor after borrowing
**And** calls `morpho.borrow()` on confirmation
**And** the UI updates to show the borrow position (debt, health factor, collateral)

**Given** a user has an active borrow position
**When** the user views their position
**Then** the UI displays: collateral amount (ITP), debt amount (USDC), health factor, liquidation price, current NAV, and accrued interest
**And** health factor updates reflect the latest oracle price

**Given** a user wants to repay debt
**When** the user enters a USDC repayment amount and confirms
**Then** the UI prompts for USDC approval (if not already approved)
**And** calls `morpho.repay()` on confirmation
**And** the UI updates the debt and health factor

**Given** a user has repaid all debt
**When** the user clicks withdraw collateral
**Then** the UI calls `morpho.withdrawCollateral()` for the full collateral amount
**And** ITP tokens are returned to the user's wallet
**And** the position is shown as closed

**Given** USDC lenders want to earn yield
**When** a lender navigates to the vault deposit section
**Then** the UI shows vault APY, total deposits, and utilization
**And** the lender can deposit USDC into the MetaMorpho vault
**And** vault shares are shown in the lender's portfolio

**Given** the frontend is running against the live E2E environment (3 issuers, AP, Morpho)
**When** a full integration check is performed (deposit → borrow → repay → withdraw)
**Then** each transaction succeeds on-chain and the UI reflects the updated state within one block
**And** the oracle price shown in the UI matches the on-chain `oracle.price()` value
