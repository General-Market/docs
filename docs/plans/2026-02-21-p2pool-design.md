# P2Pool Vision Design

## Overview

Replace Vision's bilateral betting system (CollateralVault + KeeperRegistry) with a sealed parimutuel P2Pool prediction market. Build in parallel alongside existing ITP system, delete old Vision code when complete.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   DATA NODE      │────→│   ISSUER NODES   │────→│   VISION.SOL     │
│   Collectors:    │     │   Tick engine:    │     │   (on-chain)     │
│   - Crypto       │     │   - Per-batch     │     │   - Batches      │
│   - Polymarket   │     │     scheduling    │     │   - Positions    │
│   - Twitch       │     │   - Resolution    │     │   - Claims       │
│   - HackerNews   │     │   - Side matching │     │   - Bot registry │
│   - Weather      │     │   - BLS signing   │     │   - 0.3% fee     │
│                  │     │   - Bitmap store  │     │                  │
│   Market catalog │     │   - Reveal        │     │   IssuerRegistry │
│   + issuer       │     │                   │     │   (BLS verify)   │
│   whitelist      │     │                   │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │        FRONTEND           │
                    │  Cards grid → expand      │
                    │  Visual / Script tabs     │
                    │  Pyodide Python runtime   │
                    │  Bitmap encode + submit   │
                    └───────────────────────────┘
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Replace Vision only, keep ITP/Investment | ITP is a separate product line, no reason to touch it |
| Contract architecture | Single `Vision.sol` monolith | Absorbs BatchRegistry + PoolVault + BotRegistry into one contract |
| Collateral | USDC | Per brief specification |
| Minimum stake | $0.10/tick | Prevent dust positions |
| Market registry | Hybrid: data-node catalog + issuer BLS whitelist | Data-node has the data, issuers curate what's valid |
| Resolution model | Universal % change for all sources | `(end - start) / start × 100` → check threshold. Same for crypto, polymarket, twitch, HN, weather |
| Tick scheduling | Per-batch independent clocks | Each batch has its own tickDuration and resolves independently |
| Withdrawal | Player-initiated: request BLS proof from issuers → submit tx | User controls timing, issuers just sign |
| Bitmap distribution | User sends to all issuers directly | Each issuer verifies `keccak256(bitmap) == on-chain hash` independently |
| Bitmap privacy | Sealed during tick, 10-min reveal after resolution | Anti-copy, strategy protection. Non-revealed = void |
| Side matching | Parimutuel per sub-market | UP vs DOWN matched, excess refunded, minority side gets better odds |
| Strategy execution | Client-side Pyodide (WASM Python) | Strategies run in browser, not on server |
| Coexistence | ITP cycle engine stays, tick engine runs in parallel | Two products, shared infra (prices, BLS, P2P) |
| Migration | Build in parallel, delete old Vision when P2Pool is live | Zero downtime migration |

## Contract: Vision.sol

Single Solidity contract handling all P2Pool logic. External deps: `IssuerRegistry` (BLS verify), `IERC20(usdc)`, `IERC20(wind)` (bot staking).

### Bot Registry (absorbed)
- `registerBot(endpoint, pubkeyHash)` + WIND stake
- `deregisterBot()`
- `getAllActiveBots()` — peer discovery for P2P bots

### Batch Management
- `createBatch(marketIds[], resolutionTypes[], tickDuration, customThresholds[])` → batchId
  - Permissionless. Issuers validate off-chain (reject resolution for invalid markets)
- `updateBatchMarkets(batchId, marketIds[], resolutionTypes[])` — creator only, after current tick resolves
- `getBatch(batchId)` → full batch config

### Player Operations
- `joinBatch(batchId, stakePerTick, bitmapHash)` + USDC deposit via transferFrom
  - Minimum stake: 0.1 USDC per tick
  - Stores: bitmapHash (32B), stakePerTick, startTick, balance, joinTimestamp
- `deposit(batchId)` — top up existing position
- `claimRewards(batchId, tickRange, balance, blsSig)` — BLS-verified via IssuerRegistry, 0.3% fee
- `withdraw(batchId, balance, blsSig)` — exit with BLS-signed balance proof, 0.3% fee

### Issuer Operations
- `pause(batchId)` — freeze batch (issuer-only, BLS-verified)
- `forceWithdraw(batchId, player)` — emergency return funds (minus fee)

### Storage Layout
```solidity
struct Batch {
    address creator;
    bytes32[] marketIds;
    uint8[] resolutionTypes;
    uint256 tickDuration;
    uint256[] customThresholds; // for up_x, down_x, flat_x
    uint256 currentTick;
    bool paused;
}

struct PlayerPosition {
    bytes32 bitmapHash;
    uint256 stakePerTick;    // min 0.1 USDC (1e5 in 6-dec USDC)
    uint256 startTick;
    uint256 balance;         // USDC deposited (minus claims)
    uint256 lastClaimedTick;
    uint256 joinTimestamp;   // for early_mult computation
}

mapping(uint256 => Batch) batches;
mapping(uint256 => mapping(address => PlayerPosition)) positions;
// batchId => player => position
```

## Issuer: Tick Engine

New `p2pool/` module in the issuer Rust crate, running alongside existing ITP cycle engine.

### Tick Scheduler
- Tracks all active batches from on-chain events
- Per batch: `currentTick`, `nextTickTime` based on `tickDuration`
- On tick boundary: triggers resolution pipeline
- Independent per batch

### Per-Tick Resolution Pipeline
1. **Gather active players** — filter by `balance > 0` and bitmap covering this tick
2. **Compute multipliers** per player:
   - `early_mult = 1 + min(time_before_tick, tick_duration)² / tick_duration²` (capped 2.0)
   - `commitment_mult = log10(total_ticks_committed + offset)` (offset default 9)
   - `total_mult = early_mult × commitment_mult`
3. **Compute effective stakes**: `effective_stake = stake × mult`
   - `balance ≥ effective_stake` → normal bet
   - `0 < balance < effective_stake` → partial (proportional weight)
   - `balance = 0` → excluded
4. **Fetch prices** from data-node for each market at tick start and tick end
5. **Check staleness** — if no price update since tick opened → cancel sub-market
6. **Resolve markets** — `% change = (end - start) / start × 100` → check against resolution type
7. **Bitmap reveal verification** — 10-min window. Non-revealed = void (stake refunded)
8. **Side matching** per sub-market:
   - `UP_total = Σ per_market_eff_stake` for UP bettors
   - `DOWN_total = Σ per_market_eff_stake` for DOWN bettors
   - `matched = min(UP_total, DOWN_total)`
   - Larger side: `matched_stake[i] = stake[i] × (matched / side_total)`, refund excess
   - Smaller side: fully matched
   - Winners: `payout = matched_stake × (1 + opposing_matched / winning_matched)`
   - Losers: lose matched_stake
   - All losers (threshold unmet): everyone refunded
   - All same side (no opponents): everyone refunded
9. **Update balances** — deduct stakes, add winnings + refunds
10. **BLS consensus** — all issuers compute same result, aggregate signatures
11. **Store**: `{tick_id, market_results[], player_balances[]}`

### Bitmap Management
- REST: `POST /p2pool/bitmap` — player submits bitmap (sent to all issuers)
- Each issuer: verify `keccak256(bitmap) == on-chain hash`
- Store: `player → batch_id → bitmap_bytes`
- Post-tick: publish all bitmaps for that tick (10-min reveal window)
- Non-revealed after 10 min → void

### Balance API
- `GET /p2pool/balance/{batch_id}/{player}` → BLS-signed balance proof
- Player uses this to call `claimRewards()` or `withdraw()` on-chain

### Coexistence
- Existing cycle engine stays for ITP
- Tick engine runs as separate tokio tasks
- Shared: price fetching, BLS signing infrastructure, P2P layer, IssuerRegistry sync

## Data Node: Market Registry + New Collectors

### Hybrid Market Registry
- Data-node provides full asset catalog from all collectors
- Issuers curate active whitelist via BLS-signed JSON:
  ```json
  { "markets": [{ "id": "btc_usd_10m", "source": "crypto", ... }], "version": 42, "blsSig": "..." }
  ```
- `GET /markets` — full catalog (all sources)
- `GET /markets/active` — issuer-whitelisted only

### Universal Resolution Data
All sources provide the same interface: `(market_id, timestamp) → f64 value`

Resolution is always: `% change = (value_at_tick_end - value_at_tick_start) / value_at_tick_start × 100`

### New Collectors

| Source | What it tracks | Market ID format | Value type |
|--------|---------------|-----------------|------------|
| Polymarket | Market odds/prices | `poly_{slug}` | Odds (0-1) |
| Twitch | Live stream viewer counts | `twitch_{channel}` | Viewer count |
| HackerNews | Story scores | `hn_{story_id}` | Score (int) |
| Weather | Station measurements | `weather_{station}_{metric}` | Temp/humidity/etc |

Each collector implements the same trait: poll source, store `(market_id, timestamp, value)` in DB.

### New Endpoints
- `GET /snapshot` — bulk market data for strategy scripts: `{ id, value, change_24h, change_7d, volume, mcap }`
- `GET /batch/{id}/state` — batch config, current tick, player count, TVL
- `GET /batch/{id}/history` — tick results, player performance over time
- `GET /backtest` — run strategy against historical data, return win rate + PnL curve

## Frontend

Single-page app replacing current Vision tab. Next.js + React.

### Main Page — Cards Grid
- All active batches as cards with animated headers
- Header auto-type by market count:
  - ≤5 markets: large sparklines
  - 6-20 markets: mini bar grid
  - 21-100 markets: result heatmap
  - 100+ markets: bitmap mosaic
  - Source-specific: weather bars, odds bars, etc.
- Card info: batch name, market count, resolution type, tick duration, player count, TVL
- `[+ CREATE BATCH]` button
- Live stats header: total batches, total players, total TVL

### Expanded Batch (inline expansion)
Click card → expands with two tabs: **VISUAL** and **SCRIPT**

Auto-select tab by market count:
- ≤20: VISUAL (market cards with ▲/▼ toggles, sparklines, price)
- 21-100: VISUAL (compact rows: toggle + name + price + change + sparkline + history)
- 100+: SCRIPT (Python editor)

**VISUAL tab features:**
- Per-market: price, sparkline, % change, ▲/▼ toggle
- History row: past results (✓/✗) + future bets (▲/▼)
- Player stats: win%, balance, stake, multiplier
- Actions: `[ALL ▲] [ALL ▼] [DEPOSIT] [WITHDRAW] [SUBMIT]`

**SCRIPT tab features:**
- Python editor (Monaco/CodeMirror)
- Template picker with backtest stats
- `[RUN PREVIEW]` — execute via Pyodide, show bitmap preview + backtest curve
- `[SAVE TEMPLATE] [DEPOSIT] [WITHDRAW] [SUBMIT]`

### Strategy System (Pyodide)
- Python runs client-side in browser via Pyodide (WASM)
- Input: market snapshot from `/snapshot` endpoint
- Output: bitmap array (1/0 per market per tick)
- Templates: pre-built strategies users can fork/modify
- Backtest: run against historical data from `/backtest` endpoint
- Bots: skip UI entirely, call data-node API + submit bitmap directly

### Batch Creation Flow
- Pick markets from active registry
- Set resolution type per market (up_0, up_30, up_x, down_0, etc.)
- Set tick duration
- Set custom thresholds for _x types
- Preview → create on-chain

## What Gets Deleted (after P2Pool live)

### Contracts
- `CollateralVault.sol`
- `KeeperRegistry.sol`
- `ReferralVault.sol`

### Frontend
- Vision leaderboard components
- Vision markets grid components
- Keeper-related UI

### Issuer
- Keeper arbitration code (if any)

### Kept
- `IssuerRegistry.sol` — BLS infra
- `BotRegistry.sol` logic → absorbed into Vision.sol
- ITP/Investment — separate product, untouched
- Data-node existing collectors — extended, not replaced
