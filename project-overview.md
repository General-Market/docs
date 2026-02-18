# Index L3 - Project Overview

> Decentralized Index Token Product (ITP) platform on Arbitrum Orbit L3

## Executive Summary

Index L3 is a blockchain-based platform for creating and managing Index Token Products (ITPs) - basket tokens representing weighted portfolios of underlying assets. The system enables decentralized order batching, BLS consensus among issuer nodes, and trade execution via Authorized Participants (APs) on centralized exchanges.

**Project Type:** Monorepo (Rust workspace + Solidity contracts)
**Primary Languages:** Rust (68,000+ LOC), Solidity (7,300+ LOC)
**Architecture:** Multi-node consensus network with off-chain execution

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Index L3 Network                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐    P2P/TCP     ┌──────────────┐                      │
│   │  Issuer 1    │◄──────────────►│  Issuer 2    │                      │
│   │  (Consensus) │                │  (Consensus) │                      │
│   └──────┬───────┘                └──────┬───────┘                      │
│          │                               │                               │
│          │         BLS Signatures        │                               │
│          └───────────────┬───────────────┘                               │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Index.sol (L3 Chain)                          │   │
│   │  - Order submission      - Batch confirmation                    │   │
│   │  - ITP creation          - Fill confirmation                     │   │
│   │  - Rebalancing           - BLS signature verification            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                          │                                               │
│                          │ TradeRequest Events                           │
│                          ▼                                               │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                         AP Service                                │  │
│   │  - Event monitoring      - Order execution (Bitget)              │  │
│   │  - Fill reporting        - Timeout handling                       │  │
│   │  - Buffer management     - Metrics & health                       │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Overview

### 1. Issuer Node (`/issuer`)

**Purpose:** Consensus participant that batches orders, coordinates BLS signing, and submits transactions.

**Key Modules:**
| Module | Description |
|--------|-------------|
| `consensus/` | BLS aggregation, signature collection, protocol state machine |
| `cycle/` | 1-second cycle management with 5 phases (COLLECT → PROPOSE → SIGN_SUBMIT → CONFIRM → REBALANCE) |
| `p2p/` | TCP transport with TLS, peer discovery (static + on-chain) |
| `chain/` | EthersChainReader/Writer for contract interaction |
| `netting/` | Order netting engine, USDT pair handling, rebalancing |
| `leader/` | Round-robin leader election per cycle |
| `price/` | Price fetching, validation, DEX integration (1inch) |
| `state/` | State reconstruction from chain events |

**Consensus Flow:**
1. Leader proposes batch of pending orders
2. Peers validate and sign batch hash
3. Leader aggregates BLS signatures (threshold: `ceil(2n/3)`)
4. On-chain `confirmBatch()` with aggregated signature
5. AP receives `TradeRequest` events and executes

---

### 2. AP Service (`/ap`)

**Purpose:** Authorized Participant that monitors chain events and executes trades on exchanges.

**Key Modules:**
| Module | Description |
|--------|-------------|
| `event_monitor/` | Polls chain for `TradeRequest` events |
| `external/bitget/` | Bitget API client with HMAC auth and rate limiting |
| `fill/` | Fill reporting back to chain via `confirmFills()` |
| `timeout/` | 60-second timeout tracking with 3 retries (NFR8) |
| `limit_enforcer/` | 0.1% price tolerance validation |
| `buffer/` | Buffer management for partial fills |
| `metrics/` | Prometheus metrics and health endpoints |

**Event Pipeline:**
```
TradeRequest → place_order → poll_fills → validate_price → report_fills
     ↓                                                          ↓
  timeout_handler (60s)                              confirmFills() on-chain
```

---

### 3. Common Library (`/common`)

**Purpose:** Shared types, traits, and integrations across all services.

**Key Exports:**
| Module | Description |
|--------|-------------|
| `types/` | `LimitOrder`, `Fill`, `ITP`, `BLSSignature` matching Solidity `TypesLib.sol` |
| `traits/` | `ChainReader`, `ChainWriter`, `P2PTransport`, `APClient`, `BLSSigner` |
| `bls/` | BN254 curve BLS implementation (ark-bn254) compatible with EVM precompiles |
| `integrations/` | 1inch (quotes + Fusion+), Jupiter, Squads v4, on-chain fallback |
| `mocks/` | `MockChain`, `MockBitget`, `MockP2P` for testing |
| `keys/` | Ed25519 key management with encrypted storage |

---

### 4. Smart Contracts (`/contracts`)

**Purpose:** On-chain order management, ITP token issuance, and BLS signature verification.

**Core Contracts:**
| Contract | Description |
|----------|-------------|
| `Index.sol` | Order submission, batch/fill confirmation, ITP management |
| `ITP.sol` | ERC-4626 vault for ITP tokens |
| `BLSCustody.sol` | BLS-signed custody execution on Arbitrum |
| `Governance.sol` | Admin, pause, ITP pause controls |

**Registries:**
| Contract | Description |
|----------|-------------|
| `IssuerRegistry.sol` | Issuer BLS keys, aggregated pubkey, key rotation |
| `CollateralRegistry.sol` | Whitelisted collateral tokens (USDC, USDT, etc.) |
| `AssetPairRegistry.sol` | Trading pairs configuration |
| `FeeRegistry.sol` | Fee tiers and ITP deployer fee claiming |

**Libraries:**
- `TypesLib.sol` - Shared type definitions
- `ErrorsLib.sol` - Custom errors (E001-E069+)
- `EventsLib.sol` - Event definitions
- `BLSLib.sol` - BLS verification using EVM precompiles

---

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Rust Runtime** | Tokio | 1.x | Async runtime |
| **Ethereum** | ethers-rs | 2.x | Chain interaction |
| **Cryptography** | ark-bn254 | 0.5 | BLS signatures (BN254 curve) |
| **P2P** | tokio-rustls | 0.26 | TLS transport |
| **Solidity** | Foundry | - | Smart contract development |
| **Contracts** | OpenZeppelin | 5.x | UUPS proxy, ERC-4626, SafeERC20 |
| **DEX Integration** | 1inch | v6 | Quote API, Fusion+ cross-chain |
| **Monitoring** | Prometheus + Grafana | - | Metrics and dashboards |

---

## Key Design Decisions

### BLS Consensus
- **Curve:** BN254 (compatible with EVM precompiles)
- **Threshold:** `ceil(2n/3)` for `n` issuers (e.g., 2/3 for 3 nodes, 14/20 for production)
- **Message Format:** `keccak256(chainId, contractAddress, cycleNumber, orderIds)`

### Cycle Timing
- **Duration:** 1 second (configurable, minimum 50ms)
- **Phases:** COLLECT (200ms) → PROPOSE (200ms) → SIGN_SUBMIT (200ms) → CONFIRM (200ms) → REBALANCE (200ms)

### Order Flow
1. User calls `submitOrder()` with USDC escrow
2. Order enters PENDING status
3. Issuers batch orders via consensus → BATCHED
4. AP executes on exchange, reports fills → FILLED
5. ITP tokens minted to user

### Security Model
- **FR13:** Issuers cannot communicate directly with AP (read on-chain fill data only)
- **Limit Enforcement:** 0.1% price tolerance per fill
- **Timeout:** 60-second order timeout with 3 retries

---

## Development Quick Start

```bash
# Prerequisites: Rust 1.83+, Foundry

# Start local environment (Anvil + deploy + 3 issuers + AP)
./start.sh

# Or with Docker
docker-compose up

# Run tests
cargo test --workspace
cd contracts && forge test
```

**Local Ports:**
| Service | Port |
|---------|------|
| Anvil (L3 RPC) | 8545 |
| Issuer 1-N | 9001-900N |
| AP | 9100 |
| Prometheus | 9090 |
| Grafana | 3000 |

---

## Project Metrics

| Part | Files | Lines of Code |
|------|-------|---------------|
| issuer | 50 | ~25,000 |
| ap | 45 | ~20,000 |
| common | 50 | ~22,000 |
| contracts | 28 | ~7,300 |
| **Total** | **173** | **~75,000** |

---

## Documentation Index

- [Project Overview](./project-overview.md) (this file)
- [Architecture](../_bmad-output/planning-artifacts/architecture.md)
- [PRD](../_bmad-output/planning-artifacts/prd.md)
- [Epics & Stories](../_bmad-output/planning-artifacts/epics.md)
- [Error Codes](./error-codes.md)
- [Implementation Artifacts](../_bmad-output/implementation-artifacts/) (70+ story docs)

---

*Generated by document-project workflow on 2026-01-31*
