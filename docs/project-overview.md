# Index L3 - Project Overview

> Decentralized Index Token Product (ITP) and prediction market platform on Arbitrum Orbit L3

## Executive Summary

Index L3 is a blockchain-based platform with two product lines: Index Token Products (ITPs) — basket tokens representing weighted portfolios of underlying assets — and Vision, a prediction market system powered by 90+ real-world data sources. The system enables decentralized order batching, BLS consensus among oracle nodes, trade execution via Authorized Participants (APs) on centralized exchanges, and parimutuel betting on observable outcomes.

**Project Type:** Monorepo (Rust workspace + Solidity contracts + Next.js frontend)
**Primary Languages:** Rust (~200,000 LOC), TypeScript (~116,000 LOC), Solidity (~15,000 LOC)
**Architecture:** Multi-node consensus network with off-chain execution
**Localization:** 4 locales (en, ja, ko, zh), 3,000+ translation keys across 13 namespaces

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Index L3 Network                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐    P2P/TCP     ┌──────────────┐                      │
│   │  Oracle 1    │◄──────────────►│  Oracle 2    │                      │
│   │  (Consensus) │                │  (Consensus) │                      │
│   └──────┬───────┘                └──────┬───────┘                      │
│          │                               │                               │
│          │         BLS Signatures        │                               │
│          └───────────────┬───────────────┘                               │
│                          │                                               │
│                          ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              Smart Contracts (L3 Chain)                          │   │
│   │                                                                  │   │
│   │  Investment.sol          Vision.sol                               │   │
│   │  ├─ Order submission     ├─ Batch creation                       │   │
│   │  ├─ Batch confirmation   ├─ Tick submission                      │   │
│   │  ├─ ITP creation         ├─ Settlement (bitmap)                  │   │
│   │  └─ Rebalancing          └─ BLS-verified outcomes                │   │
│   │                                                                  │   │
│   │  BLSCustody.sol    Governance.sol    OracleRegistry.sol          │   │
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
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                       Data Node (Vision)                          │  │
│   │  - 90+ real-world data source integrations                       │  │
│   │  - Market resolution via observable outcomes                      │  │
│   │  - Categories: crypto, stocks, weather, transport, sports, etc.  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Overview

### 1. Oracle Node (`/oracle`)

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
| `nav/` | ITP NAV computation from on-chain inventory |

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
| `metrics/` | Health status and internal metrics |

**Event Pipeline:**
```
TradeRequest → place_order → poll_fills → validate_price → report_fills
     ↓                                                          ↓
  timeout_handler (60s)                              confirmFills() on-chain
```

---

### 3. Data Node (`/data-node`)

**Purpose:** Market data aggregation for Vision prediction markets. Fetches, normalizes, and serves real-world data from 90+ external sources.

**Architecture:** Each source is a self-contained Rust module implementing a common trait. The data node exposes an API consumed by oracles for market resolution.

**Source Categories (90+ integrations):**
| Category | Examples |
|----------|----------|
| Crypto/DeFi | CoinGecko, DeFiLlama, PumpFun |
| Stocks/Finance | Nasdaq, Finnhub, FINRA, TWSE |
| Economic | BLS (labor stats), ECB, BOE, EIA |
| Weather/Climate | OpenMeteo, NOAA tides, NDBC, NWPS, AirNow |
| Transportation | DB trains, Ryanair, FAA delays, TfL Tube, Paris Metro, MTA Subway, GTFS-RT, Tomtom Traffic |
| Entertainment | Steam, Twitch, TMDb, Last.fm, Anilist, BGG, Lichess, PandaScore |
| Tech/Code | GitHub, npm, PyPI, Crates.io, Cloudflare, Hacker News |
| Government/Legal | Congress, CourtListener, CBP Border, USA Spending, NYC 311 |
| Space/Science | ISS, Space Weather, Earthquake, Volcano, PubMed, OpenAlex, Crossref |
| Real Estate/Utilities | Power Outages, NRC Nuclear, Parking, EV Charging, CityBikes |
| Maritime/Aviation | AIS Stream, Maritime, Military Aircraft, Flights |
| Nature/Wildlife | eBird, Movebank, Animals, Wildfire |
| Other | 4chan, Reddit, Chaturbate, McBroken, Shelter, Epidemic, IODA |

---

### 4. Common Library (`/common`)

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

### 5. Smart Contracts (`/contracts`)

**Purpose:** On-chain order management, ITP token issuance, Vision prediction markets, bridge custody, and BLS signature verification.

**Contract Architecture (10 subdirectories + root):**

| Directory | Contracts | Description |
|-----------|-----------|-------------|
| `core/` | Investment.sol, InvestmentStorage.sol, ITP.sol, BLSCustody.sol | Order submission, batch/fill confirmation, ITP vault (ERC-4626), BLS-signed custody |
| `vision/` | Vision.sol, BotRegistry.sol | Prediction market batches, tick resolution, bot registration |
| `oracle/` | ITPNAVOracle.sol | On-chain NAV oracle for ITP pricing |
| `bridge/` | BridgeProxy.sol, BridgedITP.sol, BridgedItpFactory.sol | Cross-chain ITP bridging |
| `custody/` | L3BridgeCustody.sol, SettlementBridgeCustody.sol | Dual-custody for L3 and settlement chains |
| `registry/` | OracleRegistry.sol, CollateralRegistry.sol, AssetPairRegistry.sol, FeeRegistry.sol, MirrorOracleRegistry.sol | Configuration registries |
| `libraries/` | TypesLib, ErrorsLib, EventsLib, BLSLib, BLSVerifier, BettingLib, DecimalLib, RebalanceLib, AdminLib, VisionMerkleProof | Shared logic |
| `irm/` | CuratorRateIRM.sol | Interest rate model for lending |
| `interfaces/` | — | Interface definitions |
| `mocks/` | — | Test mocks |
| (root) | Governance.sol | Admin, pause, ITP pause controls |

**50 contract files, ~15,000 lines of Solidity.**

---

### 6. Frontend (`/frontend`)

**Purpose:** Next.js 14 application with App Router, serving both ITP and Vision products.

**Stack:** Next.js 14, TypeScript, Tailwind CSS, wagmi/viem, next-intl

**Internationalization:**
- 4 locales: English, Japanese, Korean, Chinese
- 13 namespaces: pages, vision, backtest, common, markets, lending, p2pool, seo, system, portfolio, buy-modal, create-itp, sell-modal
- 3,000+ translation keys wired through next-intl
- All UI strings externalized — no hardcoded text in components

**Route Structure (`/app/[locale]/`):**
| Route | Description |
|-------|-------------|
| `/` | Home / landing |
| `/index` | Index listing |
| `/itp/[itpId]` | ITP detail — 12 analytics sections |
| `/sources` | Vision source catalog |
| `/source/[sourceId]` | Vision source detail with markets |
| `/explorer` | Chain explorer |
| `/learn/[slug]` | Educational content |
| `/profile/[address]` | User portfolio & positions |
| `/agent/[address]` | Agent detail |
| `/points` | Points / rewards |
| `/about`, `/terms`, `/privacy` | Static pages |

**ITP Detail Page (`/itp/[itpId]`) — 12 Sections:**
KeyStatsBar, HoldingsTable, PerformanceChart, NavCanvas, PortfolioBreakdown, FounderDemographics, FundFacts, FundingOverview, ConcentrationMetrics, DefiHealth, InvestmentObjective, TradeCta

**Vision Components:**
- Dual-balance architecture: L3 balances (18 decimals) + Settlement balances (6 decimals)
- Bitmap editor for batch entry with tick urgency detection
- Position visibility with bitmap persistence across sessions
- Source detail with category navigation, consensus popup, strategy list
- Deposit/withdraw modals for both L3 and Settlement flows

**Component Count:** ~585 TypeScript/TSX files, ~116,000 LOC

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
| **Frontend** | Next.js | 14 | React framework with App Router |
| **i18n** | next-intl | - | Internationalization (4 locales) |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS |
| **Wallet** | wagmi + viem | - | Wallet connection and chain interaction |
| **DEX Integration** | 1inch | v6 | Quote API, Fusion+ cross-chain |

---

## Key Design Decisions

### BLS Consensus
- **Curve:** BN254 (compatible with EVM precompiles)
- **Threshold:** `ceil(2n/3)` for `n` oracles (e.g., 2/3 for 3 nodes, 14/20 for production)
- **Message Format:** `keccak256(chainId, contractAddress, cycleNumber, orderIds)`

### Cycle Timing
- **Duration:** 1 second (configurable, minimum 50ms)
- **Phases:** COLLECT (200ms) → PROPOSE (200ms) → SIGN_SUBMIT (200ms) → CONFIRM (200ms) → REBALANCE (200ms)

### Order Flow (ITP)
1. User calls `submitOrder()` with USDC escrow
2. Order enters PENDING status
3. Oracles batch orders via consensus → BATCHED
4. AP executes on exchange, reports fills → FILLED
5. ITP tokens minted to user

### Vision Market Flow
1. Data source publishes observable outcome (e.g., BTC price, flight delay, earthquake magnitude)
2. Users enter batch positions via bitmap before lock phase
3. Oracle nodes resolve tick via BLS-signed consensus
4. Settlement distributes pool to winning positions (parimutuel)

### ITP Pricing (ETF Model)
- At creation, weights convert to fixed per-share quantities: `qty[i] = (weight[i] * 1e18) / price[i]`
- NAV floats with underlying prices: `NAV = sum(qty[i] * price[i]) / 1e18`
- Buy/sell mint/burn proportional shares without changing quantities
- Rebalance recalculates quantities to preserve NAV at new weights

### Dual-Chain Decimal Handling
| Chain | USDC Decimals | Context |
|-------|--------------|---------|
| L3 (Orbit) | 18 | Vision balances, TVL, PnL, leaderboard, batch pools |
| Settlement | 6 | Settlement deposits, AP keeper balances, bridge custody |

### Security Model
- **FR13:** Oracles cannot communicate directly with AP (read on-chain fill data only)
- **Limit Enforcement:** 0.1% price tolerance per fill
- **Timeout:** 60-second order timeout with 3 retries
- **BLS Never Bypassed:** No test mode, no mock paths, no admin overrides

---

## E2E Test Suite

**57 test files** organized across two Playwright projects running in parallel:

| Project | Test Range | Execution | Coverage |
|---------|-----------|-----------|----------|
| ITP | 00–09, 16–18 | Serial | Wallet, buy/sell, lending, create ITP, backtester, oracle resilience, bridge, portfolio, multi-ITP |
| Vision | 10–15, 19–21 | Serial | Sources, deposit, batch entry, claim/withdraw, settlement bridge, display formatting |
| Shared | 22–46 | Both | API smoke, decimal regression, system health, faucet, swarm, leaderboard, liquidation |

The two project groups run concurrently on 2 workers. All tests use a mock wallet with Anvil auto-accept for local runs, and adapt (never skip) for testnet execution.

---

## Development Quick Start

```bash
# Prerequisites: Rust 1.83+, Foundry, Node 20+

# Switch environment
./switch-env.sh local    # Local Anvil dev
./switch-env.sh testnet  # VPS testnet

# Start local environment (Anvil + deploy + 3 oracles + AP)
./start.sh

# Run tests
cargo test --workspace
cd contracts && forge test
cd frontend && npm run dev

# Run E2E (specific test, not full suite)
cd frontend && npx playwright test --config=e2e/playwright.config.ts e2e/tests/02-buy-itp.spec.ts
```

**Local Ports:**
| Service | Port |
|---------|------|
| Anvil (L3 RPC) | 8545 |
| Oracle 1-N | 9001-900N |
| AP | 9100 |
| Frontend | 3000 |

---

## Project Metrics

| Component | Files | Lines of Code |
|-----------|-------|---------------|
| oracle | 128 | ~86,000 |
| data-node | 243 | ~81,000 |
| common | 81 | ~25,000 |
| ap | 28 | ~11,000 |
| contracts | 50 | ~15,000 |
| frontend | 585 | ~116,000 |
| **Total** | **~1,115** | **~334,000** |

---

## Documentation Index

- [Project Overview](./project-overview.md) (this file)
- [Architecture](../_bmad-output/planning-artifacts/architecture.md)
- [PRD](../_bmad-output/planning-artifacts/prd.md)
- [Epics & Stories](../_bmad-output/planning-artifacts/epics.md)
- [Error Codes](./error-codes.md)
- [Adding a Data Source](../data-node/ADDING_A_DATA_SOURCE.md)
- [Implementation Artifacts](../_bmad-output/implementation-artifacts/) (70+ story docs)

---

*Updated 2026-03-21*
