# Docs Rework: Index + Vision Tabs + AI-Agent-First

**Date:** 2026-02-22
**Status:** Design

## Problem

Current docs mix Index (ITPs on L3) and Vision (prediction market on Arbitrum) into one flat navigation. They share no chain infrastructure — Vision runs on Arbitrum, Index runs on the Orbit L3. The products need fully separate documentation. Additionally, there's no AI-agent discovery layer (llms.txt) and no operational runbooks (SKILL.md) for autonomous Vision bots.

## Design

### Three-Layer Architecture (Resend Pattern)

| Layer | Asset | Audience | Purpose |
|-------|-------|----------|---------|
| Discovery | `llms.txt` (root + docs) | AI agents | Find the right page in <20 lines |
| Documentation | Mintlify (2-tab) | Humans + AI | Learn concepts, browse API, copy-paste |
| Execution | `SKILL.md` files | Autonomous bots | Step-by-step operational runbooks |

### Mintlify Tab Structure

Two fully independent product tabs. No shared sections — each product has its own chain info, contract addresses, error codes, and glossary.

```
Tabs:
┌────────────────────────────┬────────────────────────────┐
│   Index                    │   Vision                   │
│   (ITPs on L3)             │   (Prediction on Arbitrum) │
└────────────────────────────┴────────────────────────────┘
```

### File Structure

```
docs/
├── mint.json
├── llms.txt                          # Full page index for AI discovery
├── favicon.svg
├── logo/
│
├── index/                            # === INDEX TAB (L3) ===
│   ├── introduction.mdx              # restored from existing
│   ├── getting-started.mdx           # restored
│   ├── concepts/
│   │   ├── itps.mdx                  # restored — NAV, quantities, rebalancing
│   │   ├── order-lifecycle.mdx       # restored — BLS consensus flow
│   │   └── lending.mdx               # restored — Morpho integration
│   ├── guides/
│   │   ├── buy-sell.mdx              # restored
│   │   ├── create-itp.mdx            # restored
│   │   ├── backtesting.mdx           # restored
│   │   └── lending.mdx               # restored
│   ├── api/
│   │   ├── overview.mdx              # restored — base URL, data-node
│   │   ├── prices.mdx                # restored
│   │   ├── itps.mdx                  # restored
│   │   ├── portfolio.mdx             # restored
│   │   ├── simulation.mdx            # restored
│   │   └── morpho.mdx                # restored
│   ├── architecture/
│   │   ├── contracts.mdx             # restored — Index.sol, BLS
│   │   ├── oracle-nodes.mdx          # restored — L3 oracle consensus
│   │   └── data-node.mdx             # restored
│   └── reference/
│       ├── error-codes.mdx           # restored — Index-specific errors
│       ├── contract-addresses.mdx    # restored — L3 deployments
│       └── glossary.mdx              # restored — Index terms
│
├── vision/                           # === VISION TAB (Arbitrum) ===
│   ├── introduction.mdx              # NEW — what Vision is
│   ├── getting-started.mdx           # NEW — place first bet on Arbitrum
│   ├── concepts/
│   │   ├── batches.mdx               # NEW — batch structure, creation
│   │   ├── bitmaps.mdx               # NEW — encoding, sealed commitment, keccak256
│   │   ├── ticks.mdx                 # NEW — resolution cycle
│   │   ├── resolution-types.mdx      # NEW — UP_0, UP_30, DOWN_0, FLAT_X
│   │   ├── balance-proofs.mdx        # NEW — BLS signed claims on Arbitrum
│   │   └── fees.mdx                  # NEW — 0.3% on profits only
│   ├── bots/
│   │   ├── overview.mdx              # NEW — bot architecture diagram
│   │   ├── quickstart.mdx            # NEW — register + first tick (Python + TS)
│   │   ├── bitmap-encoding.mdx       # NEW — big-endian bit packing spec
│   │   ├── strategies.mdx            # NEW — example strategies
│   │   └── lifecycle.mdx             # NEW — poll→join→submit→claim loop
│   ├── api/
│   │   ├── overview.mdx              # NEW — base URLs (p2pool API on Arbitrum)
│   │   ├── batches.mdx               # NEW — list/get active batches
│   │   ├── state.mdx                 # NEW — batch state snapshots
│   │   ├── bitmap.mdx                # NEW — POST bitmap submission
│   │   ├── balance.mdx               # NEW — GET balance proofs
│   │   ├── ticks.mdx                 # NEW — tick history
│   │   └── leaderboard.mdx           # NEW — leaderboard endpoints
│   └── reference/
│       ├── resolution-types.mdx      # NEW — full enum reference
│       ├── contract-addresses.mdx    # NEW — Vision on Arbitrum
│       ├── error-codes.mdx           # NEW — Vision-specific errors
│       └── glossary.mdx              # NEW — Vision terms (bitmap, tick, batch, etc.)
│
├── snippets/
│   ├── chain-info-l3.mdx             # Index L3 chain config
│   ├── chain-info-arb.mdx            # Vision Arbitrum chain config
│   └── nav-formula.mdx               # NAV formula (Index only)
│
└── skills/                           # === AI AGENT SKILL FILES ===
    ├── SKILL.md                      # Router — points to sub-skills
    ├── vision-bot.md                 # Autonomous bot: register→poll→bet→claim
    ├── vision-bitmap.md              # Bitmap encoding spec (machine-readable)
    └── vision-api.md                 # API quick-reference for agents
```

### Examples Strategy (Resend Pattern)

Resend uses a **dual approach**: a monorepo for feature examples + standalone repos for framework integrations. We adopt the same pattern.

**Monorepo: `General-Market/examples`**

```
examples/
├── vision-bot-python/               # Complete Python bot — register→poll→bet→claim
│   ├── .env.example                  # PRIVATE_KEY=, RPC_URL=, VISION_ADDRESS=
│   ├── README.md                     # Setup: 4 numbered steps
│   ├── requirements.txt
│   └── bot.py                        # Single-file bot (~100 lines)
│
├── vision-bot-typescript/            # Complete TypeScript bot
│   ├── .env.example
│   ├── README.md
│   ├── package.json
│   └── src/index.ts                  # Single-file bot
│
├── vision-bitmap-encoder/            # Standalone bitmap encoding utility
│   ├── README.md
│   ├── encode.py                     # Python: markets[] → bitmap bytes → keccak256
│   └── encode.ts                     # TypeScript equivalent
│
├── vision-strategy-momentum/         # Example strategy: momentum-based
│   ├── README.md
│   ├── strategy.py
│   └── backtest.py
│
├── vision-strategy-mean-reversion/   # Example strategy: mean reversion
│   ├── README.md
│   └── strategy.py
│
└── index-nav-reader/                 # Read ITP NAV from chain
    ├── README.md
    ├── read_nav.py
    └── read_nav.ts
```

**README template** (every example follows this):

```markdown
# Vision Bot (Python)

Autonomous trading bot for General Market Vision prediction market on Arbitrum.

## Setup

1. Clone: `git clone https://github.com/General-Market/examples`
2. Configure: `cp .env.example .env` and fill in your private key
3. Install: `pip install -r requirements.txt`
4. Run: `python bot.py`

## What it does

Registers as a bot → polls active batches → generates UP/DOWN predictions →
encodes bitmap → joins batch on-chain → claims rewards via BLS balance proofs.

## License

MIT
```

**How docs link to examples:**

Every guide page ends with a "Try it yourself" section using `CardGroup`:

```mdx
## Try it yourself

<CardGroup>
  <Card
    title="Python Bot Example"
    icon="arrow-up-right-from-square"
    href="https://github.com/General-Market/examples/tree/main/vision-bot-python"
  >
    See the full source code.
  </Card>
  <Card
    title="TypeScript Bot Example"
    icon="arrow-up-right-from-square"
    href="https://github.com/General-Market/examples/tree/main/vision-bot-typescript"
  >
    See the full source code.
  </Card>
</CardGroup>
```

**Dedicated examples page** at `vision/examples.mdx` — lists all examples in one `CardGroup` grid.

### llms-full.txt (Full API Dump for AI Agents)

Resend also serves a `llms-full.txt` — the complete API documentation inlined into a single file. An AI agent can consume the entire API surface in one fetch instead of crawling page by page.

**`docs/llms-full.txt`** — auto-generated or manually maintained, contains:

```
# General Market — Full Documentation

## Vision API

### GET /p2pool/batches
Returns all active Vision batches.

Parameters: none

Response:
{
  "batches": [
    {
      "id": number,
      "creator": string (address),
      "market_ids": string[],
      "resolution_types": number[],
      "tick_duration": number (seconds),
      "market_count": number,
      "player_count": number,
      "tvl": string (uint256 wei),
      "paused": boolean
    }
  ]
}

### GET /p2pool/batch/{id}/state
...

### POST /p2pool/bitmap
...

[every endpoint, every parameter, every response schema]
```

This is served at `generalmarket.io/llms-full.txt` via frontend route or static file.

### mint.json Configuration

```json
{
  "tabs": [
    { "name": "Index", "url": "index" },
    { "name": "Vision", "url": "vision" }
  ],
  "navigation": [
    {
      "group": "Getting Started",
      "pages": ["index/introduction", "index/getting-started"]
    },
    {
      "group": "Concepts",
      "pages": ["index/concepts/itps", "index/concepts/order-lifecycle", "index/concepts/lending"]
    },
    {
      "group": "Guides",
      "pages": ["index/guides/buy-sell", "index/guides/create-itp", "index/guides/backtesting", "index/guides/lending"]
    },
    {
      "group": "API Reference",
      "pages": ["index/api/overview", "index/api/prices", "index/api/itps", "index/api/portfolio", "index/api/simulation", "index/api/morpho"]
    },
    {
      "group": "Architecture",
      "pages": ["index/architecture/contracts", "index/architecture/oracle-nodes", "index/architecture/data-node"]
    },
    {
      "group": "Reference",
      "pages": ["index/reference/error-codes", "index/reference/contract-addresses", "index/reference/glossary"]
    },
    {
      "group": "Getting Started",
      "pages": ["vision/introduction", "vision/getting-started"]
    },
    {
      "group": "Concepts",
      "pages": [
        "vision/concepts/batches", "vision/concepts/bitmaps", "vision/concepts/ticks",
        "vision/concepts/resolution-types", "vision/concepts/balance-proofs", "vision/concepts/fees"
      ]
    },
    {
      "group": "Bot Development",
      "pages": [
        "vision/bots/overview", "vision/bots/quickstart", "vision/bots/bitmap-encoding",
        "vision/bots/strategies", "vision/bots/lifecycle"
      ]
    },
    {
      "group": "API Reference",
      "pages": [
        "vision/api/overview", "vision/api/batches", "vision/api/state",
        "vision/api/bitmap", "vision/api/balance", "vision/api/ticks", "vision/api/leaderboard"
      ]
    },
    {
      "group": "Reference",
      "pages": [
        "vision/reference/resolution-types", "vision/reference/contract-addresses",
        "vision/reference/error-codes", "vision/reference/glossary"
      ]
    },
    {
      "group": "Examples",
      "pages": ["vision/examples"]
    }
  ]
}
```

### SKILL.md Design (for Autonomous Bots)

Root `SKILL.md` — router file:

```markdown
# General Market — AI Agent Skills

## Products
- **Index**: On-chain ETFs (ITPs) on Arbitrum Orbit L3
- **Vision**: Sealed parimutuel prediction market on Arbitrum

## Skills

### vision-bot
Full lifecycle for autonomous Vision trading bots.
Register → poll batches → encode bitmap → join → claim rewards.
→ [vision-bot.md](./vision-bot.md)

### vision-bitmap
Bitmap encoding specification. Big-endian bit packing,
keccak256 commitment, market ordering.
→ [vision-bitmap.md](./vision-bitmap.md)

### vision-api
Complete Vision API reference in machine-parseable format.
Endpoints, parameters, response schemas.
→ [vision-api.md](./vision-api.md)
```

Each sub-skill is **prescriptive** (tells the agent what to do, in order) not descriptive (explains what the system does). Includes:
- Exact code patterns (Python + TypeScript)
- Required parameters and types
- Error handling constraints
- BLS verification — never skip
- Bitmap encoding spec with byte-level detail

### llms.txt Design

**Root `llms.txt`** (served at `generalmarket.io/llms.txt`):

```
# General Market

> Two on-chain financial products: Index (ETF-like baskets on L3) and
> Vision (sealed parimutuel prediction market on Arbitrum).

## Documentation
- [Full docs index](https://generalmarket.io/docs/llms.txt)

## Skills (for AI agents)
- [Vision Bot SKILL](https://generalmarket.io/docs/skills/SKILL.md)

## Index (ITPs)
- Chain: Arbitrum Orbit L3, Chain ID 111222333
- RPC: http://142.132.164.24/
- Collateral: USDC (18 decimals)

## Vision (Prediction Market)
- Chain: Arbitrum
- Contract: Vision.sol
```

**Docs `llms.txt`** — auto-generated by Mintlify or manually maintained. Lists every page with title + one-line description.

### Local Dev Wiring

1. `docs/` directory runs Mintlify dev server: `npx mintlify dev --port 3030`
2. Frontend `next.config.ts` rewrite updated to support local:
   ```typescript
   const DOCS_URL = process.env.DOCS_URL || "https://generalmarket.mintlify.dev";
   // rewrites:
   // /docs → DOCS_URL/docs
   // /docs/:path* → DOCS_URL/docs/:path*
   ```
3. `start.sh` gets optional docs dev server launch
4. `llms.txt` served via frontend static file or API route

### API Docs: Structured Parameters (Resend Pattern)

All API parameter docs use Mintlify `<ParamField>` instead of markdown tables:

```mdx
<ParamField body="batch_id" type="number" required>
  Unique batch identifier
</ParamField>

<ParamField body="bitmap" type="bytes" required>
  Big-endian bit-packed prediction bitmap. Size: `ceil(market_count / 8)` bytes.
  Bit value 1 = UP, 0 = DOWN.
</ParamField>
```

This is machine-parseable by AI agents (structured metadata in the MDX AST) vs flat markdown tables.

### Error Docs: Actionable Resolutions (Resend Pattern)

Every error gets a concrete resolution step:

```mdx
### INVALID_BITMAP_LENGTH
**HTTP 400** — Bitmap byte length does not match `ceil(market_count / 8)`.

**Fix:** Check the market count for the batch via `GET /p2pool/batch/{id}/state`
and encode exactly `ceil(market_count / 8)` bytes.
```

## Decisions

- **No shared sections** — Vision (Arbitrum) and Index (L3) are completely separate products on different chains
- **Restore existing Index docs** — don't rewrite what works, just move into `index/` subdirectory
- **Vision docs from scratch** — new content derived from source code, contracts, and existing API
- **SKILL.md targets autonomous bots** — not human developers using coding tools
- **ParamField over tables** — structured, machine-parseable API parameters
- **llms.txt + llms-full.txt** — root discovery, docs index, and full API dump for single-fetch consumption
- **Monorepo examples** — `General-Market/examples` with per-feature directories, not standalone repos (we don't have 55 frameworks to support)
- **"Try it yourself" convention** — every guide ends with CardGroup linking to example code
- **Minimal example repos** — single-file bots, `.env.example`, 4-step README. AI agents and humans can clone and run in <1 minute
