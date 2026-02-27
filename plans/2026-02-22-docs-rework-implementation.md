# Docs Rework: Index + Vision + AI-Agent-First — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split docs into two fully independent Mintlify tabs (Index on L3, Vision on Arbitrum), add llms.txt/llms-full.txt/SKILL.md for AI agents, add GitHub examples, wire local dev.

**Architecture:** Two-tab Mintlify setup with separate navigation groups per product. Four-layer AI strategy: llms.txt (discovery), docs/llms.txt (page index), llms-full.txt (full API dump), SKILL.md (autonomous bot runbooks). Examples monorepo with single-file bots and strategies. Frontend proxies docs with configurable `DOCS_URL` env var.

**Tech Stack:** Mintlify (MDX), Next.js rewrites, markdown SKILL files, GitHub examples repo.

**Design doc:** `docs/plans/2026-02-22-docs-rework-design.md`

---

### Task 1: Restore and restructure Index docs from git

**Files:**
- Restore from git: 30+ files from `docs/` at HEAD
- Create: `docs/index/` directory tree
- Modify: move restored files into `docs/index/` subdirectory

**Step 1: Restore all Index-relevant docs from git HEAD**

```bash
# Restore docs content from git (all deleted files)
git checkout HEAD -- docs/introduction.mdx
git checkout HEAD -- docs/getting-started.mdx
git checkout HEAD -- docs/concepts/itps.mdx
git checkout HEAD -- docs/concepts/order-lifecycle.mdx
git checkout HEAD -- docs/concepts/lending.mdx
git checkout HEAD -- docs/guides/buy-sell.mdx
git checkout HEAD -- docs/guides/create-itp.mdx
git checkout HEAD -- docs/guides/backtesting.mdx
git checkout HEAD -- docs/guides/lending.mdx
git checkout HEAD -- docs/api/overview.mdx
git checkout HEAD -- docs/api/prices.mdx
git checkout HEAD -- docs/api/itps.mdx
git checkout HEAD -- docs/api/portfolio.mdx
git checkout HEAD -- docs/api/simulation.mdx
git checkout HEAD -- docs/api/morpho.mdx
git checkout HEAD -- docs/architecture/contracts.mdx
git checkout HEAD -- docs/architecture/issuer-nodes.mdx
git checkout HEAD -- docs/architecture/data-node.mdx
git checkout HEAD -- docs/reference/error-codes.mdx
git checkout HEAD -- docs/reference/contract-addresses.mdx
git checkout HEAD -- docs/reference/glossary.mdx
git checkout HEAD -- docs/snippets/chain-info.mdx
git checkout HEAD -- docs/snippets/nav-formula.mdx
git checkout HEAD -- docs/favicon.svg
git checkout HEAD -- docs/logo/dark.svg
git checkout HEAD -- docs/logo/light.svg
```

**Step 2: Create Index directory structure and move files**

```bash
mkdir -p docs/index/{concepts,guides,api,architecture,reference}

# Move top-level docs
mv docs/introduction.mdx docs/index/introduction.mdx
mv docs/getting-started.mdx docs/index/getting-started.mdx

# Move concepts
mv docs/concepts/itps.mdx docs/index/concepts/itps.mdx
mv docs/concepts/order-lifecycle.mdx docs/index/concepts/order-lifecycle.mdx
mv docs/concepts/lending.mdx docs/index/concepts/lending.mdx

# Move guides
mv docs/guides/buy-sell.mdx docs/index/guides/buy-sell.mdx
mv docs/guides/create-itp.mdx docs/index/guides/create-itp.mdx
mv docs/guides/backtesting.mdx docs/index/guides/backtesting.mdx
mv docs/guides/lending.mdx docs/index/guides/lending.mdx

# Move API
mv docs/api/overview.mdx docs/index/api/overview.mdx
mv docs/api/prices.mdx docs/index/api/prices.mdx
mv docs/api/itps.mdx docs/index/api/itps.mdx
mv docs/api/portfolio.mdx docs/index/api/portfolio.mdx
mv docs/api/simulation.mdx docs/index/api/simulation.mdx
mv docs/api/morpho.mdx docs/index/api/morpho.mdx

# Move architecture
mv docs/architecture/contracts.mdx docs/index/architecture/contracts.mdx
mv docs/architecture/issuer-nodes.mdx docs/index/architecture/issuer-nodes.mdx
mv docs/architecture/data-node.mdx docs/index/architecture/data-node.mdx

# Move reference
mv docs/reference/error-codes.mdx docs/index/reference/error-codes.mdx
mv docs/reference/contract-addresses.mdx docs/index/reference/contract-addresses.mdx
mv docs/reference/glossary.mdx docs/index/reference/glossary.mdx
```

**Step 3: Update internal links in restored Index docs**

All internal links in the restored docs (e.g., `/concepts/itps`, `/guides/buy-sell`) must be prefixed with `/index/`. Scan each `.mdx` file and update `href` attributes and markdown links. Example transformations:
- `href="/concepts/itps"` → `href="/index/concepts/itps"`
- `href="/getting-started"` → `href="/index/getting-started"`
- `[Resolution Types](/reference/resolution-types)` → `[Resolution Types](/index/reference/resolution-types)` (but resolution-types now lives under Vision — update cross-product links to point to `/vision/reference/resolution-types`)

Remove any Vision/P2Pool references from the Index introduction page (they are now a separate product).

**Step 4: Clean up empty directories**

```bash
# Remove now-empty old directories
rmdir docs/concepts docs/guides docs/api docs/architecture docs/reference 2>/dev/null
```

**Step 5: Commit**

```bash
git add docs/index/
git commit -m "docs: restructure Index docs into index/ subdirectory"
```

---

### Task 2: Write new mint.json with two-tab layout

**Files:**
- Create: `docs/mint.json` (overwrite restored version)

**Step 1: Write the new mint.json**

```json
{
  "$schema": "https://mintlify.com/schema.json",
  "name": "General Market",
  "logo": {
    "dark": "/logo/dark.svg",
    "light": "/logo/light.svg"
  },
  "favicon": "/favicon.svg",
  "colors": {
    "primary": "#18181B",
    "light": "#71717A",
    "dark": "#09090B",
    "anchors": {
      "from": "#18181B",
      "to": "#3F3F46"
    }
  },
  "topbarLinks": [
    {
      "name": "Launch App",
      "url": "https://generalmarket.io"
    }
  ],
  "topbarCtaButton": {
    "name": "Launch App",
    "url": "https://generalmarket.io"
  },
  "tabs": [
    { "name": "Index", "url": "index" },
    { "name": "Vision", "url": "vision" }
  ],
  "anchors": [
    {
      "name": "Discord",
      "icon": "discord",
      "url": "https://discord.gg/xsfgzwR6"
    },
    {
      "name": "App",
      "icon": "arrow-up-right-from-square",
      "url": "https://generalmarket.io"
    }
  ],
  "navigation": [
    {
      "group": "Getting Started",
      "pages": ["index/introduction", "index/getting-started"]
    },
    {
      "group": "Concepts",
      "pages": [
        "index/concepts/itps",
        "index/concepts/order-lifecycle",
        "index/concepts/lending"
      ]
    },
    {
      "group": "Guides",
      "pages": [
        "index/guides/buy-sell",
        "index/guides/create-itp",
        "index/guides/backtesting",
        "index/guides/lending"
      ]
    },
    {
      "group": "API Reference",
      "pages": [
        "index/api/overview",
        "index/api/prices",
        "index/api/itps",
        "index/api/portfolio",
        "index/api/simulation",
        "index/api/morpho"
      ]
    },
    {
      "group": "Architecture",
      "pages": [
        "index/architecture/contracts",
        "index/architecture/issuer-nodes",
        "index/architecture/data-node"
      ]
    },
    {
      "group": "Reference",
      "pages": [
        "index/reference/error-codes",
        "index/reference/contract-addresses",
        "index/reference/glossary"
      ]
    },
    {
      "group": "Getting Started",
      "pages": ["vision/introduction", "vision/getting-started"]
    },
    {
      "group": "Concepts",
      "pages": [
        "vision/concepts/batches",
        "vision/concepts/bitmaps",
        "vision/concepts/ticks",
        "vision/concepts/resolution-types",
        "vision/concepts/balance-proofs",
        "vision/concepts/fees"
      ]
    },
    {
      "group": "Bot Development",
      "pages": [
        "vision/bots/overview",
        "vision/bots/quickstart",
        "vision/bots/bitmap-encoding",
        "vision/bots/strategies",
        "vision/bots/lifecycle"
      ]
    },
    {
      "group": "API Reference",
      "pages": [
        "vision/api/overview",
        "vision/api/batches",
        "vision/api/state",
        "vision/api/bitmap",
        "vision/api/balance",
        "vision/api/ticks",
        "vision/api/leaderboard"
      ]
    },
    {
      "group": "Reference",
      "pages": [
        "vision/reference/resolution-types",
        "vision/reference/contract-addresses",
        "vision/reference/error-codes",
        "vision/reference/glossary"
      ]
    },
    {
      "group": "Examples",
      "pages": ["vision/examples"]
    }
  ],
  "footerSocials": {
    "x": "https://x.com/otc_max",
    "discord": "https://discord.gg/xsfgzwR6"
  }
}
```

**Step 2: Verify JSON is valid**

```bash
python3 -c "import json; json.load(open('docs/mint.json')); print('Valid JSON')"
```

**Step 3: Commit**

```bash
git add docs/mint.json
git commit -m "docs: new mint.json with Index + Vision tabs"
```

---

### Task 3: Write Vision introduction and getting-started pages

**Files:**
- Create: `docs/vision/introduction.mdx`
- Create: `docs/vision/getting-started.mdx`

**Step 1: Create Vision directory structure**

```bash
mkdir -p docs/vision/{concepts,bots,api,reference}
```

**Step 2: Write `docs/vision/introduction.mdx`**

Content should cover:
- What Vision is: sealed parimutuel prediction market on Arbitrum
- How it works (30-second version): pick batch → place bets (UP/DOWN bitmap) → tick resolves → winners split pool
- Key features: sealed commitments (no front-running), BLS-verified claims, bot-friendly, 0.3% fee on profits only
- Vision contract address: `0x0BFC626B583e93A5F793Bc2cAa195BDBB2ED9F20` on chain 421611337
- Use `<CardGroup>` for feature cards and quick links to concepts/bots/API
- Do NOT reference Index product — Vision tab is fully independent

**Step 3: Write `docs/vision/getting-started.mdx`**

Content should cover:
- Prerequisites: Arbitrum wallet, USDC
- Step 1: Browse active batches on the Vision page
- Step 2: Select a batch (explain tick duration, markets, resolution type)
- Step 3: Choose UP/DOWN predictions per market
- Step 4: Deposit USDC and join
- Step 5: Wait for tick resolution
- Step 6: Claim rewards
- Include code snippets for programmatic interaction (Python + TypeScript)

**Step 4: Commit**

```bash
git add docs/vision/introduction.mdx docs/vision/getting-started.mdx
git commit -m "docs: add Vision introduction and getting-started"
```

---

### Task 4: Write Vision concepts pages (6 files)

**Files:**
- Create: `docs/vision/concepts/batches.mdx`
- Create: `docs/vision/concepts/bitmaps.mdx`
- Create: `docs/vision/concepts/ticks.mdx`
- Create: `docs/vision/concepts/resolution-types.mdx`
- Create: `docs/vision/concepts/balance-proofs.mdx`
- Create: `docs/vision/concepts/fees.mdx`

**Step 1: Write `docs/vision/concepts/batches.mdx`**

Content from Vision.sol + types.rs:
- What a batch is: group of markets with shared pool, tick duration, resolution config
- Creation: `createBatch(marketIds, resolutionTypes, tickDuration, customThresholds)`
- Batch struct fields: id, creator, market_ids, resolution_types, tick_duration, custom_thresholds, paused
- Batch lifecycle: created → running → paused (by issuers via BLS)
- Metadata: `setBatchMetadata(batchId, name, description, websiteUrl, videoUrl, imageUrl)`
- Max assets: 100+ per batch
- Tick durations: 5min, 10min, 30min, 1h, 4h, 1 day (MAX_TICK_DURATION = 30 days)

**Step 2: Write `docs/vision/concepts/bitmaps.mdx`**

Content from bot.py + types.rs:
- Big-endian bit packing: bit 0 = MSB of byte 0, bit 7 = LSB of byte 0
- 1 = UP, 0 = DOWN
- Size: `ceil(marketCount / 8)` bytes
- Sealed commitment: player submits `keccak256(bitmap)` on-chain, reveals actual bytes to issuers
- Example with 10 markets: 2 bytes, last 6 bits unused
- Code examples (Python + TypeScript) for encoding/decoding

**Step 3: Write `docs/vision/concepts/ticks.mdx`**

Content from engine.rs + types.rs:
- Tick = one resolution interval
- At tick end: issuers fetch prices → resolve outcomes → compute payoffs → update balances
- MarketOutcome enum: Up, Down, Flat, Cancelled, AllSameSide, AllLosers
- AllSameSide: everyone bet the same direction → no losers → pot returned
- AllLosers: no one on winning side → pot distributed (edge case)
- Commitment offset: bitmaps must be submitted `commitment_offset` ticks before resolution (default: 9)
- Reveal window: 600 seconds (10 min) after tick ends

**Step 4: Write `docs/vision/concepts/resolution-types.mdx`**

Content from IVision.sol:
- Table of 8 resolution types (UP_0=0, UP_30=1, UP_X=2, DOWN_0=3, DOWN_30=4, DOWN_X=5, FLAT_0=6, FLAT_X=7)
- How each determines winners
- Custom thresholds for X types (basis points)
- Examples with real price movements

**Step 5: Write `docs/vision/concepts/balance-proofs.mdx`**

Content from Vision.sol claimRewards/withdraw:
- Off-chain balance tracking by issuers
- BLS-signed balance proof flow:
  1. `GET /vision/balance/{batchId}/{player}`
  2. Issuers compute balance (deposits + winnings - losses - fees)
  3. BLS signature: `keccak256(abi.encode(chainId, contractAddr, "CLAIM", batchId, player, fromTick, toTick, newBalance))`
  4. Player calls `claimRewards(batchId, fromTick, toTick, newBalance, blsSignature)`
  5. Contract verifies BLS sig against issuer registry (2/3+ threshold)
- BLS is NEVER bypassed — no test modes, no admin overrides
- Use `<Warning>` callout for BLS emphasis

**Step 6: Write `docs/vision/concepts/fees.mdx`**

Content from Vision.sol:
- 0.3% (30 bps) on profits only via `PROTOCOL_FEE_BPS = 30`
- Formula: `fee = (winnings * 30) / 10000`, payout = winnings - fee
- Losers pay nothing
- Fee collection: `collectFees()` on Vision contract
- Minimum stake: `MIN_STAKE_PER_TICK = 1e5` (0.1 USDC with 6 decimals)

**Step 7: Commit**

```bash
git add docs/vision/concepts/
git commit -m "docs: add Vision concept pages (batches, bitmaps, ticks, resolution, proofs, fees)"
```

---

### Task 5: Write Vision bot development pages (5 files)

**Files:**
- Create: `docs/vision/bots/overview.mdx`
- Create: `docs/vision/bots/quickstart.mdx`
- Create: `docs/vision/bots/bitmap-encoding.mdx`
- Create: `docs/vision/bots/strategies.mdx`
- Create: `docs/vision/bots/lifecycle.mdx`

**Step 1: Write `docs/vision/bots/overview.mdx`**

- Architecture diagram (ASCII): Register → Poll → Encode → Join → Submit → Claim loop
- Bot registration: free, no collateral, `registerBot(endpoint, pubkeyHash)`
- Key env vars: `VISION_API_URL`, `BOT_PRIVATE_KEY`, `DEPOSIT_AMOUNT`, `STAKE_PER_TICK`
- USDC uses 6 decimals (not 18)
- Link to quickstart + lifecycle pages

**Step 2: Write `docs/vision/bots/quickstart.mdx`**

Minimal working bot in Python + TypeScript (from bot.py reference):
1. Install deps
2. Set env vars (.env.example)
3. Register bot on-chain
4. Poll `/vision/batches`
5. Encode bitmap for one batch
6. Join batch (approve USDC + joinBatch)
7. Submit bitmap to issuers (`POST /vision/bitmap`)
8. Claim rewards after ticks resolve

Full working code in `<CodeGroup>` (Python + TypeScript).
End with "Try it yourself" `<CardGroup>` linking to examples repo.

**Step 3: Write `docs/vision/bots/bitmap-encoding.mdx`**

Deep technical reference:
- Bit packing spec with diagrams
- Big-endian: bit 0 = MSB byte 0, bit 7 = LSB byte 0, bit 8 = MSB byte 1
- Code examples: `encode_bitmap(bets: List[bool]) -> bytes` in Python
- Code examples: `encodeBitmap(bets: boolean[]): Uint8Array` in TypeScript
- Keccak256 hashing for commitment
- Edge cases: empty batch, single market, 100+ markets
- Verification: `keccak256(bitmap) == on-chain bitmapHash`

**Step 4: Write `docs/vision/bots/strategies.mdx`**

Example strategies (non-financial-advice):
- Random (baseline): random UP/DOWN per market
- Momentum: bet UP if price trending up over last N ticks
- Mean reversion: bet opposite of recent direction
- Correlation-based: group correlated assets
- Each with Python code snippet
- Link to backtest API: `POST /vision/backtest`
- End with "Try it yourself" linking to strategy examples in repo

**Step 5: Write `docs/vision/bots/lifecycle.mdx`**

Full lifecycle in detail (from bot.py):
1. Register bot (one-time): `registerBot(endpoint, pubkeyHash)`
2. Poll batches: `GET /vision/batches` every N seconds
3. Generate predictions: strategy function → `bool[]`
4. Encode bitmap: `bets[] → bytes → keccak256(bytes)`
5. Approve USDC: `approve(visionAddress, depositAmount)`
6. Join batch: `joinBatch(batchId, depositAmount, stakePerTick, bitmapHash)`
7. Wait for chain indexing (~6 seconds)
8. Submit bitmap: `POST /vision/bitmap { player, batch_id, bitmap_hex, expected_hash }`
9. Update bitmap (optional): `updateBitmap(batchId, newHash)` + re-submit
10. Claim rewards: `GET /vision/balance/{batchId}/{player}` → `claimRewards(batchId, fromTick, toTick, newBalance, blsSig)`
11. Withdraw: `withdraw(batchId, finalBalance, blsSig)` → exits batch

**Step 6: Commit**

```bash
git add docs/vision/bots/
git commit -m "docs: add Vision bot development docs (overview, quickstart, encoding, strategies, lifecycle)"
```

---

### Task 6: Write Vision API reference pages (7 files)

**Files:**
- Create: `docs/vision/api/overview.mdx`
- Create: `docs/vision/api/batches.mdx`
- Create: `docs/vision/api/state.mdx`
- Create: `docs/vision/api/bitmap.mdx`
- Create: `docs/vision/api/balance.mdx`
- Create: `docs/vision/api/ticks.mdx`
- Create: `docs/vision/api/leaderboard.mdx`

**Source of truth:** `issuer/src/vision/api.rs`

All API pages MUST use Mintlify `<ParamField>` components (not markdown tables) for parameters. Use `<Tabs>` with cURL + Python + TypeScript for every endpoint. Use `<ResponseExample>` for responses.

**Step 1: Write `docs/vision/api/overview.mdx`**

- Base URLs:
  - Vision API (issuer): `https://generalmarket.io/api/vision` (proxied to issuer port 10001)
  - Data Node: `https://generalmarket.io/api` (port 8200)
- No authentication required
- JSON responses
- Rate limiting: none currently

**Step 2: Write `docs/vision/api/batches.mdx`**

Endpoints:
- `GET /vision/batches` — list all active batches
- `GET /vision/markets` — list all available markets

Use `<ParamField>` for response fields:
```mdx
<ParamField body="id" type="number">
  Unique batch identifier
</ParamField>
<ParamField body="market_ids" type="string[]">
  Asset identifiers for each market in the batch (e.g., "BTC", "ETH")
</ParamField>
<ParamField body="tvl" type="string">
  Total value locked in USDC as uint256 wei string (6 decimals)
</ParamField>
```

**Step 3: Write `docs/vision/api/state.mdx`**

- `GET /vision/batch/{id}/state` — full batch state with player positions

**Step 4: Write `docs/vision/api/bitmap.mdx`**

- `POST /vision/bitmap` — submit bitmap to issuers

Request body:
```mdx
<ParamField body="player" type="string" required>
  Ethereum address of the player (checksummed)
</ParamField>
<ParamField body="batch_id" type="number" required>
  Batch to submit bitmap for
</ParamField>
<ParamField body="bitmap_hex" type="string" required>
  Hex-encoded bitmap (e.g., "0xff00ab"). Big-endian, 1=UP, 0=DOWN.
</ParamField>
<ParamField body="expected_hash" type="string" required>
  keccak256 hash of the bitmap bytes. Must match the on-chain commitment.
</ParamField>
```

**Step 5: Write `docs/vision/api/balance.mdx`**

- `GET /vision/balance/{batch_id}/{player}` — get BLS-signed balance proof

Response includes balance + BLS signature for on-chain claim.

**Step 6: Write `docs/vision/api/ticks.mdx`**

- `GET /vision/batch/{id}/history` — tick history for a batch
- `GET /vision/reveal/{batch_id}/{tick_id}` — revealed bitmaps (after reveal window)

**Step 7: Write `docs/vision/api/leaderboard.mdx`**

- `GET /vision/leaderboard` — player rankings

Response fields: rank, walletAddress, pnl, winRate, roi, totalVolume, portfolioBets, avgPortfolioSize, largestPortfolio.

**Step 8: Commit**

```bash
git add docs/vision/api/
git commit -m "docs: add Vision API reference (batches, state, bitmap, balance, ticks, leaderboard)"
```

---

### Task 7: Write Vision reference pages (4 files)

**Files:**
- Create: `docs/vision/reference/resolution-types.mdx`
- Create: `docs/vision/reference/contract-addresses.mdx`
- Create: `docs/vision/reference/error-codes.mdx`
- Create: `docs/vision/reference/glossary.mdx`

**Step 1: Write `docs/vision/reference/resolution-types.mdx`**

Full enum reference table:

| Value | Name | Threshold | UP wins when... |
|-------|------|-----------|-----------------|
| 0 | UP_0 | 0% | Price increases by any amount |
| 1 | UP_30 | 0.30% | Price increases by ≥30 basis points |
| 2 | UP_X | Custom | Price increases by ≥X basis points |
| 3 | DOWN_0 | 0% | Price decreases by any amount |
| 4 | DOWN_30 | 0.30% | Price decreases by ≥30 basis points |
| 5 | DOWN_X | Custom | Price decreases by ≥X basis points |
| 6 | FLAT_0 | 0% | Price does not change |
| 7 | FLAT_X | Custom | Price stays within ±X basis points |

**Step 2: Write `docs/vision/reference/contract-addresses.mdx`**

From `deployments/vision-deployment.json`:
- Chain: Arbitrum (chain ID 421611337)
- Vision contract: `0x0BFC626B583e93A5F793Bc2cAa195BDBB2ED9F20`
- Deployer: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- USDC: 6 decimals on Arbitrum

**Step 3: Write `docs/vision/reference/error-codes.mdx`**

From Vision.sol custom errors — each with actionable resolution (Resend pattern):

```mdx
### InvalidBLSSignature
**Reverts when:** BLS signature verification fails.
**Fix:** Ensure you're using a fresh balance proof from `GET /vision/balance/{batchId}/{player}`.
BLS proofs expire — request a new one immediately before submitting the claim transaction.

### BatchNotFound
**Reverts when:** The batch ID does not exist.
**Fix:** Verify the batch ID via `GET /vision/batches`.

### StakeBelowMinimum
**Reverts when:** `stakePerTick < 1e5` (0.1 USDC).
**Fix:** Set stakePerTick to at least `100000` (0.1 USDC with 6 decimals).
```

...and so on for all 15 error codes.

**Step 4: Write `docs/vision/reference/glossary.mdx`**

Vision-specific terms: Batch, Bitmap, Tick, Resolution Type, Balance Proof, BLS Signature, Sealed Commitment, Stake Per Tick, TVL, Bot Registry, Reveal Window, Commitment Offset.

**Step 5: Commit**

```bash
git add docs/vision/reference/
git commit -m "docs: add Vision reference pages (resolution types, addresses, errors, glossary)"
```

---

### Task 8: Write Vision examples page

**Files:**
- Create: `docs/vision/examples.mdx`

**Step 1: Write `docs/vision/examples.mdx`**

```mdx
---
title: "Examples"
description: "Working code examples for Vision prediction market"
---

# Examples

Complete, runnable examples for building on Vision.

<CardGroup cols={2}>
  <Card
    title="Python Bot"
    icon="arrow-up-right-from-square"
    href="https://github.com/General-Market/examples/tree/main/vision-bot-python"
  >
    See the full source code.
  </Card>
  <Card
    title="TypeScript Bot"
    icon="arrow-up-right-from-square"
    href="https://github.com/General-Market/examples/tree/main/vision-bot-typescript"
  >
    See the full source code.
  </Card>
  <Card
    title="Bitmap Encoder"
    icon="arrow-up-right-from-square"
    href="https://github.com/General-Market/examples/tree/main/vision-bitmap-encoder"
  >
    See the full source code.
  </Card>
  <Card
    title="Momentum Strategy"
    icon="arrow-up-right-from-square"
    href="https://github.com/General-Market/examples/tree/main/vision-strategy-momentum"
  >
    See the full source code.
  </Card>
  <Card
    title="Mean Reversion Strategy"
    icon="arrow-up-right-from-square"
    href="https://github.com/General-Market/examples/tree/main/vision-strategy-mean-reversion"
  >
    See the full source code.
  </Card>
</CardGroup>
```

**Step 2: Commit**

```bash
git add docs/vision/examples.mdx
git commit -m "docs: add Vision examples page with GitHub links"
```

---

### Task 9: Create examples repo content

**Files:**
- Create: `examples/vision-bot-python/bot.py`
- Create: `examples/vision-bot-python/.env.example`
- Create: `examples/vision-bot-python/README.md`
- Create: `examples/vision-bot-python/requirements.txt`
- Create: `examples/vision-bot-typescript/src/index.ts`
- Create: `examples/vision-bot-typescript/.env.example`
- Create: `examples/vision-bot-typescript/README.md`
- Create: `examples/vision-bot-typescript/package.json`
- Create: `examples/vision-bitmap-encoder/encode.py`
- Create: `examples/vision-bitmap-encoder/encode.ts`
- Create: `examples/vision-bitmap-encoder/README.md`
- Create: `examples/vision-strategy-momentum/strategy.py`
- Create: `examples/vision-strategy-momentum/README.md`
- Create: `examples/vision-strategy-mean-reversion/strategy.py`
- Create: `examples/vision-strategy-mean-reversion/README.md`

**Step 1: Create directory structure**

```bash
mkdir -p examples/{vision-bot-python,vision-bot-typescript/src,vision-bitmap-encoder,vision-strategy-momentum,vision-strategy-mean-reversion}
```

**Step 2: Write Python bot example**

Based on `vision-bot/bot.py` — simplified to ~80 lines. Single file, minimal deps (web3, requests, eth-abi).

`.env.example`:
```
RPC_URL=https://arb1.arbitrum.io/rpc
VISION_API_URL=https://generalmarket.io/api/vision
BOT_PRIVATE_KEY=0x...
VISION_ADDRESS=0x0BFC626B583e93A5F793Bc2cAa195BDBB2ED9F20
DEPOSIT_AMOUNT=10
STAKE_PER_TICK=1
```

README follows template: Title → Description → 4-step Setup → What it does → License (MIT).

**Step 3: Write TypeScript bot example**

Same logic as Python bot but using viem + ethers. Single `src/index.ts` file.

**Step 4: Write bitmap encoder examples**

Standalone utility: `encode_bitmap(bets: List[bool]) -> tuple[bytes, str]` returning (bitmap, keccak256_hash).
Both Python and TypeScript versions.

**Step 5: Write strategy examples**

Momentum: uses last N tick results to predict next direction.
Mean reversion: bets opposite of recent trend.
Each is a single Python file with a `generate_bets(batch_state) -> List[bool]` function.

**Step 6: Commit**

```bash
git add examples/
git commit -m "docs: add Vision example code (bots, encoder, strategies)"
```

---

### Task 10: Create AI agent files (llms.txt, llms-full.txt, SKILL.md)

**Files:**
- Create: `docs/llms.txt`
- Create: `docs/llms-full.txt`
- Create: `docs/skills/SKILL.md`
- Create: `docs/skills/vision-bot.md`
- Create: `docs/skills/vision-bitmap.md`
- Create: `docs/skills/vision-api.md`
- Create: `frontend/public/llms.txt` (root-level discovery)

**Step 1: Write root `llms.txt`**

Place at `frontend/public/llms.txt` so it's served at `generalmarket.io/llms.txt`:

```
# General Market

> Two on-chain financial products: Index (ETF-like tokenized baskets on Arbitrum Orbit L3)
> and Vision (sealed parimutuel prediction market on Arbitrum).

## Documentation
- [Full docs index](https://generalmarket.io/docs/llms.txt)
- [Full API reference](https://generalmarket.io/docs/llms-full.txt)

## Skills (for AI agents)
- [Vision Bot SKILL](https://github.com/General-Market/index/tree/main/docs/skills/SKILL.md)

## Index (ITPs)
- Chain: Arbitrum Orbit L3, Chain ID 111222333
- RPC: http://142.132.164.24/
- Collateral: USDC (18 decimals)

## Vision (Prediction Market)
- Chain: Arbitrum, Chain ID 421611337
- Contract: 0x0BFC626B583e93A5F793Bc2cAa195BDBB2ED9F20
- Collateral: USDC (6 decimals)
- API: https://generalmarket.io/api/vision
```

**Step 2: Write `docs/llms.txt`** (page index)

List every documentation page with title + one-line description:

```
# General Market Documentation Index

## Index — Getting Started
- [Introduction](https://generalmarket.io/docs/index/introduction): Protocol overview, on-chain ETFs, NAV pricing
- [Getting Started](https://generalmarket.io/docs/index/getting-started): Wallet setup, network config, first trade

## Index — Concepts
- [ITPs](https://generalmarket.io/docs/index/concepts/itps): Tokenized baskets, per-share quantities, rebalancing
...

## Vision — Getting Started
- [Introduction](https://generalmarket.io/docs/vision/introduction): Sealed parimutuel prediction market on Arbitrum
...

## Vision — Bot Development
- [Quickstart](https://generalmarket.io/docs/vision/bots/quickstart): Register and run your first bot
...

## Vision — API Reference
- [Batches](https://generalmarket.io/docs/vision/api/batches): List and query active batches
...
```

**Step 3: Write `docs/llms-full.txt`**

Complete Vision API inlined into one file. Every endpoint with parameters, request body, response schema. Derived from `issuer/src/vision/api.rs`.

**Step 4: Create `docs/skills/` directory and write SKILL.md router**

```bash
mkdir -p docs/skills
```

Router SKILL.md:
```markdown
# General Market — AI Agent Skills

| Feature | Skill | Use When |
|---------|-------|----------|
| Vision trading bot | vision-bot | Building autonomous prediction market bot |
| Bitmap encoding | vision-bitmap | Encoding UP/DOWN predictions into bitmap bytes |
| Vision API calls | vision-api | Querying batches, submitting bitmaps, claiming rewards |
```

**Step 5: Write `docs/skills/vision-bot.md`**

Prescriptive runbook for autonomous bots. NOT descriptive docs — tells the agent exactly what to do in order. Includes:
- Required env vars and their values
- Step-by-step code (Python)
- Error handling constraints
- BLS requirement emphasis
- USDC decimal warning (6, not 18)

**Step 6: Write `docs/skills/vision-bitmap.md`**

Machine-readable bitmap spec:
- Encoding algorithm with pseudocode
- Bit ordering diagram
- Keccak256 hashing
- Verification against on-chain hash
- Edge cases

**Step 7: Write `docs/skills/vision-api.md`**

Every Vision endpoint in a flat, machine-parseable format:
```
## GET /vision/batches
Returns: { batches: BatchSummary[] }
No parameters.

## POST /vision/bitmap
Body: { player: address, batch_id: u64, bitmap_hex: hex, expected_hash: hex }
Returns: { accepted: bool, batch_id: u64, player: address }
```

**Step 8: Commit**

```bash
git add docs/llms.txt docs/llms-full.txt docs/skills/ frontend/public/llms.txt
git commit -m "docs: add AI agent files (llms.txt, llms-full.txt, SKILL.md)"
```

---

### Task 11: Wire local docs development

**Files:**
- Modify: `frontend/next.config.ts` — add `DOCS_URL` env var support
- Modify: `start.sh` — add optional mintlify dev server

**Step 1: Update `frontend/next.config.ts`**

Replace the hardcoded Mintlify URL:

```typescript
// Before:
// source: "/docs", destination: "https://generalmarket.mintlify.dev/docs"

// After:
const DOCS_URL = process.env.DOCS_URL || "https://generalmarket.mintlify.dev";
// ...
{ source: "/docs", destination: `${DOCS_URL}/docs` },
{ source: "/docs/:path*", destination: `${DOCS_URL}/docs/:path*` },
```

**Step 2: Add `llms.txt` rewrite**

Add a rewrite so `generalmarket.io/llms.txt` serves from `frontend/public/llms.txt`:
```typescript
// llms.txt is served automatically from public/ by Next.js — no rewrite needed
```

Verify: `frontend/public/llms.txt` will be served at `/llms.txt` automatically by Next.js static file serving.

**Step 3: Update `start.sh`**

Add optional docs dev server launch:
```bash
# Docs (optional)
if [ "$DOCS" = "1" ]; then
  echo "Starting Mintlify docs dev server..."
  cd docs && npx mintlify dev --port 3030 &
  cd ..
  export DOCS_URL="http://localhost:3030"
fi
```

**Step 4: Verify locally**

```bash
# Terminal 1: Start Mintlify dev
cd docs && npx mintlify dev --port 3030

# Terminal 2: Start frontend with local docs
DOCS_URL=http://localhost:3030 npm run dev --prefix frontend
```

Navigate to `http://localhost:3000/docs` — should show Mintlify docs with both tabs.

**Step 5: Commit**

```bash
git add frontend/next.config.ts start.sh
git commit -m "docs: wire local dev with DOCS_URL env var"
```

---

### Task 12: Final verification and cleanup

**Step 1: Verify mint.json is valid**

```bash
cd docs && python3 -c "import json; json.load(open('mint.json')); print('Valid')"
```

**Step 2: Verify all pages referenced in mint.json exist**

```bash
cd docs && python3 -c "
import json, os
mint = json.load(open('mint.json'))
missing = []
for group in mint['navigation']:
    for page in group['pages']:
        if not os.path.exists(f'{page}.mdx'):
            missing.append(page)
if missing:
    print('MISSING:', missing)
else:
    print('All pages exist')
"
```

**Step 3: Run Mintlify dev to check for errors**

```bash
cd docs && npx mintlify dev --port 3030
```

Check for: broken links, missing pages, rendering errors.

**Step 4: Clean up old empty directories**

```bash
# Remove any leftover empty directories from the old structure
find docs/ -type d -empty -delete
```

**Step 5: Final commit if any fixes needed**

```bash
git add -A docs/
git commit -m "docs: cleanup and fix any issues from restructuring"
```
