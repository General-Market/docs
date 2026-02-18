# Index L3 Documentation

> Decentralized Index Token Product (ITP) platform on Arbitrum Orbit L3

---

## Quick Reference

| Property | Value |
|----------|-------|
| **Project Type** | Monorepo (Rust + Solidity) |
| **Primary Language** | Rust (Tokio async), Solidity 0.8.24 |
| **Architecture** | Multi-node BLS consensus network |
| **Chain** | Arbitrum Orbit L3 (Chain ID: 111222333) |
| **Entry Points** | `issuer/src/main.rs`, `ap/src/main.rs` |

---

## Repository Structure

```
index/
├── issuer/                 # Rust issuer node (consensus, batching, P2P)
│   ├── src/
│   │   ├── consensus/      # BLS signature aggregation
│   │   ├── cycle/          # 1-second cycle manager
│   │   ├── p2p/            # TCP transport + peer discovery
│   │   ├── chain/          # On-chain reader/writer
│   │   ├── netting/        # Order netting engine
│   │   └── main.rs         # Binary entry point
│   └── tests/
│
├── ap/                     # Rust AP service (trade execution)
│   ├── src/
│   │   ├── event_monitor/  # Chain event polling
│   │   ├── external/       # Bitget API client
│   │   ├── fill/           # Fill reporting
│   │   ├── timeout/        # Order timeout handler
│   │   └── main.rs         # Binary entry point
│   └── tests/
│
├── common/                 # Shared Rust library
│   ├── src/
│   │   ├── types/          # LimitOrder, Fill, ITP (matches Solidity)
│   │   ├── traits/         # ChainReader, P2PTransport, BLSSigner
│   │   ├── bls/            # BN254 BLS implementation
│   │   ├── integrations/   # 1inch, Jupiter, Squads
│   │   └── mocks/          # MockChain, MockBitget
│   └── tests/
│
├── contracts/              # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── core/           # Index.sol, ITP.sol, BLSCustody.sol
│   │   ├── registry/       # Issuer, Collateral, Asset, Fee registries
│   │   ├── interfaces/     # Contract interfaces
│   │   └── libraries/      # TypesLib, ErrorsLib, BLSLib
│   ├── script/             # Deployment scripts
│   └── test/               # Foundry tests
│
├── scripts/                # Shell scripts (e2e, deployment)
├── monitoring/             # Prometheus + Grafana config
├── deployments/            # Contract addresses per network
└── docs/                   # This documentation
```

---

## Generated Documentation

### Core Documentation
- [Project Overview](./project-overview.md) - System architecture and component overview

### Planning Artifacts
- [Architecture](../_bmad-output/planning-artifacts/architecture.md) - Detailed technical architecture
- [PRD](../_bmad-output/planning-artifacts/prd.md) - Product requirements document
- [Epics & Stories](../_bmad-output/planning-artifacts/epics.md) - Implementation breakdown

### Reference
- [Error Codes](./error-codes.md) - Complete error code reference
- [Error Handling Audit](./error-handling-audit-report.md) - Error handling patterns analysis

### Implementation Artifacts
- [Epic 1: Foundation](../_bmad-output/implementation-artifacts/) - Stories 1.1-1.6
- [Epic 2: Smart Contracts](../_bmad-output/implementation-artifacts/) - Stories 2.1-2.15
- [Epic 3: Issuer Node](../_bmad-output/implementation-artifacts/) - Stories 3.1-3.17
- [Epic 4: AP Service](../_bmad-output/implementation-artifacts/) - Stories 4.1-4.10
- [Epic 5: Integrations](../_bmad-output/implementation-artifacts/) - Stories 5.1-5.12
- [Epic 6: Deployment & E2E](../_bmad-output/implementation-artifacts/) - Stories 6.1-6.19

---

## Getting Started

### Prerequisites
- [Rust](https://rustup.rs/) 1.83+
- [Foundry](https://getfoundry.sh/)
- Docker (optional)

### Quick Start
```bash
# Clone and enter project
cd index

# Start full local environment
./start.sh

# Alternative: Docker
docker-compose up

# Run all tests
cargo test --workspace
cd contracts && forge test
```

### CLI Reference

**Issuer Node:**
```bash
issuer --node-id 1 --port 9001 --rpc http://localhost:8545
issuer --real-p2p --peer 192.168.1.10:9002  # Production mode
issuer --mock --skip-reconstruction          # Development mode
```

**AP Service:**
```bash
ap --port 9100 --rpc http://localhost:8545 --mock-bitget
ap --deployment-file ./deployments/local.json  # Real chain mode
```

---

## Network Configuration

| Network | Chain ID | RPC | Collateral |
|---------|----------|-----|------------|
| Local (Anvil) | 111222333 | http://localhost:8545 | ETH |
| Index L3 Testnet | 111222333 | https://index.rpc.zeeve.net | WIND (18 dec) |

---

## Key Technical Concepts

### BLS Consensus
- **Curve:** BN254 (EVM precompile compatible)
- **Threshold:** ceil(2n/3) signatures required
- **Message:** `keccak256(chainId, contract, cycleNumber, orderIds)`

### Order Lifecycle
```
PENDING → BATCHED → FILLED/EXPIRED
    ↓        ↓          ↓
submitOrder  confirmBatch  confirmFills/refundExpiredOrder
```

### Cycle Phases (1 second total)
1. **COLLECT** (200ms) - Gather pending orders
2. **PROPOSE** (200ms) - Leader proposes batch
3. **SIGN_SUBMIT** (200ms) - Peers sign, leader aggregates
4. **CONFIRM** (200ms) - Submit to chain
5. **REBALANCE** (200ms) - Process rebalance requests

---

## For AI Assistants

When working on this codebase:

1. **Types match between Rust and Solidity** - See `common/src/types/` and `contracts/src/libraries/TypesLib.sol`
2. **Error codes are centralized** - See `docs/error-codes.md` and `contracts/src/libraries/ErrorsLib.sol`
3. **Existing architecture doc** - `_bmad-output/planning-artifacts/architecture.md` has detailed design
4. **Implementation stories** - 70+ detailed story docs in `_bmad-output/implementation-artifacts/`
5. **Design decisions** - Logged in `backlog.md` at project root

---

*Documentation generated 2026-01-31 | Index L3 v0.1.0*
