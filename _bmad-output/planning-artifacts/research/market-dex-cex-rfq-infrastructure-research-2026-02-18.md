---
stepsCompleted: [1, 2]
inputDocuments: []
workflowType: 'research'
lastStep: 2
research_type: 'market'
research_topic: 'DEX/CEX RFQ Infrastructure for ITP Index Integration'
research_goals: 'Map the actual RFQ backends that major CEX and DEX players use under the hood, then identify integration paths for ITP index products'
user_name: 'max'
date: '2026-02-18'
web_research_enabled: true
source_verification: true
---

# Market Research: DEX/CEX RFQ Infrastructure for ITP Index Integration

**Date:** 2026-02-18
**Author:** max
**Research Type:** Market Research

---

## Research Initialization

### Research Understanding Confirmed

**Topic**: DEX/CEX RFQ backends — what systems the big players actually use
**Goals**: Map the RFQ backends behind Binance, Coinbase, OKX, and top DEX aggregators before dev
**Research Type**: Market Research
**Date**: 2026-02-18

**Scope confirmed by user on 2026-02-18** — Focus on finding the actual backends first.

---

## RFQ Backend Mapping: Who Uses What

### The Big Picture

Every major CEX wallet and DEX aggregator uses one of ~6 core RFQ/aggregation backends under the hood. Here's the map:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CONSUMER LAYER (Wallets/Apps)                     │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ Coinbase     │ Binance Web3 │ MetaMask     │ OKX Wallet             │
│ (Exchange +  │ Wallet       │ Swaps        │                        │
│  Base App)   │              │              │                        │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                    AGGREGATION LAYER (Routing)                       │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ 0x Swap API  │ Li.Fi        │ 1inch +      │ OKX X Routing          │
│ (exclusive   │ (meta-agg    │ OKX DEX +    │ (in-house engine)      │
│  for CB)     │ for Binance) │ Exodus XO    │                        │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                    RFQ PROTOCOL LAYER                                │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ 0x RFQ       │ UniswapX     │ CoW Protocol │ Hashflow / Bebop       │
│ (off-chain   │ (Dutch       │ (Solver      │ (Pure RFQ with         │
│  relay +     │  auction +   │  auction +   │  off-chain pricing)    │
│  on-chain    │  RFQ hybrid) │  batch       │                        │
│  settle)     │              │  settlement) │                        │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                    MARKET MAKER LAYER (Liquidity)                    │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ Wintermute   │ Jump Trading │ Cumberland   │ Amber Group            │
│ ($5B+/day)   │ (Top 5)      │ (DRW)        │ ($5B+/day)             │
├──────────────┼──────────────┼──────────────┼────────────────────────┤
│ GSR Markets  │ DWF Labs     │ Tokka Labs   │ + dozens more PMMs     │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                    AMM / ON-CHAIN LIQUIDITY LAYER                    │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ Uniswap V3/4 │ Curve        │ Balancer V2  │ PancakeSwap            │
│ (wstETH/ETH) │ (stETH/ETH)  │ (wstETH)     │ (BNB Chain)            │
└──────────────┴──────────────┴──────────────┴────────────────────────┘
```

---

### CEX Web3 Wallets — Backend Breakdown

#### 1. Coinbase → **0x Protocol (Swap API)**

Coinbase uses **0x** as its exclusive on-chain swap infrastructure across all products:

| Coinbase Product | Backend | Details |
|---|---|---|
| **Coinbase Exchange** (DEX trading) | 0x Swap API | Launched onchain assets Aug 2025. Access to millions of tokens via 0x RFQ + AMM aggregation |
| **Base App** | 0x Swap API | Powers social trading, creator tokens |
| **Developer Platform (CDP)** | 0x Swap API | SDK for builders on Base |

**RFQ specifics:** 0x RFQ is exclusive liquidity — zero slippage, MEV-protected. Available on Mainnet, Polygon, Arbitrum, Base. Market makers identified by HTTP endpoints, respond in milliseconds.

_Source: [0x + Coinbase Case Study](https://0x.org/case-studies/coinbase/), [Coinbase Exchange Case Study](https://0x.org/case-studies/coinbase/exchange/)_

#### 2. Binance Web3 Wallet → **Li.Fi (Meta-Aggregator)**

Binance doesn't use a single RFQ backend — it uses **Li.Fi** as a meta-aggregation middleware:

| Component | Backend | Details |
|---|---|---|
| **Swap routing** | Li.Fi → taps into 1inch, 0x, Paraswap | Li.Fi is an aggregator-of-aggregators |
| **Cross-chain bridge** | Li.Fi → 15 bridges | Smart routing across chains |
| **DEX access** | 29 DEXs via Li.Fi | Recommended provider shown based on best price |

**Key insight:** Binance Web3 Wallet does NOT have its own RFQ system. Li.Fi routes to whichever aggregator/DEX gives the best price, which may include 0x RFQ, 1inch Fusion, etc.

_Source: [Binance Web3 Wallet New Features](https://www.binance.com/en/blog/ecosystem/binance-web3-wallets-new-features-4711616998755531254), [Binance FAQ](https://www.binance.com/en/support/faq/what-is-binance-wallet-swap-7ebe19e8ff884cc09a9dbb064aff131f)_

#### 3. OKX Wallet → **OKX X Routing (In-House)**

OKX built its own aggregation engine:

| Component | Backend | Details |
|---|---|---|
| **DEX aggregator** | OKX X Routing | 500+ DEXs, 25+ chains, 40ms execution |
| **RFQ system** | OKX PMM (Private Market Maker) | PMMs submit RFQ orders via API |
| **MEV protection** | Built-in | X Routing includes MEV protection |

**RFQ specifics:** PMMs create RFQ orders, expose via REST/WebSocket API. Takers request quotes, makers respond, takers execute best quote. Full API at `POST /api/v5/rfq/create-rfq`.

_Source: [OKX PMM RFQ Docs](https://www.okx.com/web3/build/docs/build-dapp/dex-pmm-rfq-process), [OKX DEX Swap](https://web3.okx.com/dex-swap)_

#### 4. MetaMask Swaps → **Multi-Aggregator (0x + 1inch + OKX + others)**

MetaMask aggregates across multiple backends simultaneously:

| Component | Backend | Details |
|---|---|---|
| **Core swap** | 0x API, 1inch, Paraswap/Velora | Original aggregator-of-aggregators approach |
| **OKX integration** | OKX DEX aggregator (June 2025) | Faster execution, reduced slippage |
| **Bridge** | Exodus XO Swap (Aug 2025) | 20,000+ trading pairs |
| **Market makers** | AirSwap (direct RFQ) | Plus AMMs like Uniswap |

_Source: [MetaMask Swaps Case Study](https://consensys.io/blockchain-use-cases/finance/metamask-swaps), [OKX+Consensys Partnership](https://cointelegraph.com/news/okx-consensys-dex-aggregator-metamask)_

---

### DEX RFQ Protocols — The Actual Backends

These are the protocols that sit behind the wallets above:

#### 1. **0x Protocol (Swap API + RFQ System)** — Most Adopted

| Aspect | Detail |
|---|---|
| **Architecture** | Off-chain order relay + on-chain settlement |
| **RFQ model** | Market makers register HTTP endpoints per asset pair. API polls them in real-time. |
| **Liquidity** | 150+ sources aggregated. RFQ quotes compete with AMM quotes — best price wins |
| **Chains** | Ethereum, Polygon, Arbitrum, Base, Optimism, + more |
| **Slippage** | 0 (RFQ orders) |
| **MEV** | Protected |
| **Users** | Coinbase, MetaMask, Robinhood, Phantom |
| **Integration** | REST API. Simple `GET /swap/v1/quote` |

_Source: [0x RFQ System Overview](https://0x.org/docs/0x-swap-api/advanced-topics/about-the-rfq-system), [0x RFQ Blog](https://0x.org/post/delivering-superior-trade-execution-with-0x-rfq)_

#### 2. **UniswapX** — Intent-Based with RFQ + Dutch Auction

| Aspect | Detail |
|---|---|
| **Architecture** | Signed intents → RFQ phase → Dutch auction fallback |
| **RFQ model** | Permissioned Quoters provide quotes. Winning quoter gets exclusive fill rights. If they fail, open Dutch auction. |
| **Fillers** | Quoters (permissioned) vs Fillers (permissionless) |
| **Chains** | Ethereum mainnet primary, expanding |
| **Unique** | Gasless swaps for users. Fillers pay gas. |

_Source: [UniswapX Whitepaper](https://app.uniswap.org/whitepaper-uniswapx.pdf), [Uniswap Docs](https://docs.uniswap.org/contracts/uniswapx/overview)_

#### 3. **1inch Fusion** — Resolver-Based RFQ

| Aspect | Detail |
|---|---|
| **Architecture** | Intent-based. Users sign orders, Resolvers fill them. |
| **RFQ model** | Resolvers are independent operators with private backends. RFQ-style execution for illiquid pairs. |
| **v2 upgrade** | 2x execution speed, partial fills, MEV protection, 40% gas savings |
| **Chains** | Ethereum, BNB, Polygon, Arbitrum, Optimism, + more |
| **Unique** | Resolver backends are private/proprietary. 1inch provides example code but each resolver builds their own. |

_Source: [1inch Fusion Deep Dive](https://blog.1inch.com/a-deep-dive-into-1inch-fusion/), [1inch Fusion Resolver Example](https://github.com/1inch/fusion-resolver-example)_

#### 4. **CoW Protocol** — Solver Auction with RFQ

| Aspect | Detail |
|---|---|
| **Architecture** | Batch auctions → Fair Combinatorial Auctions (Jul 2025 upgrade) |
| **RFQ model** | Solvers compete in auctions. Some solvers (like Copium) specialize in RFQ/market maker liquidity, others (Barter) in AMM routing. |
| **Unique** | Coincidence of Wants (CoW) — matches orders peer-to-peer before hitting AMMs |
| **Chains** | Ethereum, Gnosis Chain |
| **Recent** | Barter acquired Copium's codebase to combine RFQ + AMM expertise |

_Source: [CoW Protocol Docs](https://docs.cow.fi/cow-protocol), [CoW Solvers](https://docs.cow.fi/cow-protocol/concepts/introduction/solvers), [Barter Acquisition](https://blockworks.co/news/barter-buys-rival-solver-codebase)_

#### 5. **Hashflow** — Pure RFQ Protocol

| Aspect | Detail |
|---|---|
| **Architecture** | Off-chain pricing with cryptographic signatures, on-chain settlement |
| **RFQ model** | Market makers publish Price Levels every second via WebSocket. Hashflow routes RFQs to best makers. Makers sign quotes. |
| **Unique** | No AMM pools. 100% market-maker driven. Off-chain pricing allows sophisticated models (volatility, historical data). |
| **Chains** | Ethereum, BNB, Polygon, Arbitrum, Optimism, Avalanche |
| **Integration** | WebSocket API. Must be allowlisted. |

_Source: [Hashflow API v3 Docs](https://docs.hashflow.com/hashflow/market-making/getting-started-api-v3), [Hashflow Overview](https://docs.hashflow.com/)_

#### 6. **Bebop** — Hybrid RFQ + Solver

| Aspect | Detail |
|---|---|
| **Architecture** | Router combines JAM (solver auction) + PMM (market maker RFQ) |
| **RFQ model** | PMMs provide quotes. JAM solvers find optimal routes. Router picks best of both. |
| **Unique** | Portfolio swaps — trade multiple tokens in one tx. Gas-optimized batch execution. |
| **Chains** | Ethereum, Polygon, Arbitrum, BNB, Optimism, Base |

_Source: [Bebop Trading APIs](https://docs.bebop.xyz/bebop/bebop-api-pmm-rfq/bebop-trading-apis-comparison), [Bebop RFQ Explainer](https://medium.com/bebop-dex/wtf-is-rfq-on-chain-19560e00058b)_

#### 7. **Velora (ex-ParaSwap)** — Aggregator with RFQ Layer

| Aspect | Detail |
|---|---|
| **Architecture** | Augustus smart contract (v6.2) with Simple/Multi/Mega path routing |
| **RFQ model** | KYC-validated market makers provide real-time quotes. Aggregated with 170+ protocol liquidity sources. |
| **Rebrand** | ParaSwap → Velora (2025). Shift from aggregator to intent-based protocol. |
| **Chains** | Ethereum, Polygon, BNB, Arbitrum, Optimism, Avalanche, Base |

_Source: [Velora/ParaSwap](https://paraswap.io/), [Augustus V6.2 Docs](https://help.velora.xyz/en/articles/9457461-augustus-v6-2-improved-security-trading-and-developer-experience)_

---

### Market Makers Powering All These RFQ Systems

The same ~10 market makers provide liquidity across ALL the RFQ protocols above:

| Market Maker | Daily Volume | Key Integrations | RFQ Services |
|---|---|---|---|
| **Wintermute** | $5B+ | 0x, Hashflow, 1inch, CEX OTC | Record $2.24B single-day OTC (Nov 2024) |
| **Jump Trading** | Top 5 globally | UniswapX filler, 0x, CEX | Institutional focus |
| **Cumberland (DRW)** | Institutional scale | 0x RFQ, OKX RFQ, CEX OTC | RFQ, algo routing, bespoke OMS |
| **GSR Markets** | 200+ assets, 25 fiat | 0x, Hashflow, CEX | Up to $100M trades, FX-grade pricing |
| **Amber Group** | $5B+ | CEX, DeFi protocols | NASDAQ-listed (AMBR) since 2025 |
| **DWF Labs** | Active | Cross-protocol | Market making + investment |

_Source: [Top Market Makers 2025](https://www.dwf-labs.com/news/20-top-crypto-market-makers), [Crypto Market Makers 2025](https://finxsol.com/blog/top-crypto-market-makers/)_

---

### How Lido/stETH Connects to This Stack

Lido is not an RFQ system — it's a **liquidity source** that sits at the bottom of the stack:

| Protocol | Pool | What It Does |
|---|---|---|
| **Curve** | stETH/ETH | Primary stETH↔ETH liquidity. Low slippage. Pool vAPY includes staking rewards. |
| **Uniswap V3** | wstETH/ETH | Non-rebasing wrapper. Better for concentrated liquidity. |
| **Balancer V2** | wstETH/ETH MetaStable | Optimized for correlated assets |

**How it connects to RFQ:** When 0x, 1inch, or any aggregator routes a swap involving stETH/wstETH, they hit these pools as liquidity sources. Market makers in RFQ systems may also hold stETH inventory and quote directly.

_Source: [Lido Integration Guide](https://docs.lido.fi/guides/lido-tokens-integration-guide/), [stETH Integration Guide](https://docs.lido.fi/guides/steth-integration-guide/)_

---

### Summary: The RFQ Backend Dependency Graph

```
Coinbase ──────→ 0x Swap API ─────→ 0x RFQ ──────→ Wintermute, Jump, Cumberland, GSR
                                  └──→ AMMs ──────→ Uniswap, Curve, Balancer

Binance Web3 ──→ Li.Fi ──────────→ 1inch ─────────→ Fusion Resolvers → same MMs
                                  └→ 0x ───────────→ 0x RFQ → same MMs
                                  └→ Paraswap/Velora → Augustus RFQ → same MMs

OKX Wallet ────→ OKX X Routing ──→ OKX PMM RFQ ──→ PMMs (own onboarding)
                                  └→ 500+ DEX AMMs

MetaMask ──────→ 0x + 1inch + OKX + Velora + AirSwap
                 (picks best across all)

UniswapX ──────→ RFQ Quoters ─────→ Wintermute, Jump (exclusive fill rights)
                 └→ Dutch Auction ─→ Permissionless fillers

CoW Protocol ──→ Solver Auction ──→ Barter (AMM+RFQ), other solvers
                                    → Market makers via solver RFQ

Hashflow ──────→ Direct RFQ ──────→ Allowlisted market makers (WebSocket)

Bebop ─────────→ JAM + PMM Router → Solvers + Market makers
```

---

## Research Status

**Step 2 Complete** — RFQ backend mapping fully documented with verified sources.

**Key Finding:** There are really only **3 dominant RFQ backends** that matter:
1. **0x Swap API** — Powers Coinbase, MetaMask, Robinhood. Easiest integration (REST API).
2. **1inch Fusion** — Powers Binance (via Li.Fi), own app. Resolver-based.
3. **OKX PMM** — Powers OKX ecosystem. Own API.

Everything else (Hashflow, Bebop, CoW, UniswapX) are either niche or federate to the same market makers.
