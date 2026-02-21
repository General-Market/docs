# Vision P2Pool Brief

## Architecture

```
┌─────────────────────────────────────────────┐
│              ISSUER NODES (BLS)             │
│  Govern the global market registry          │
│  Auto-update markets (polymarket, twitch..) │
│  Store per tick:                            │
│    - resolution of each market              │
│    - balance of each player                 │
│  Cancel stale sub-markets per tick          │
└──────────────────┬──────────────────────────┘
                   │ publishes / signs
                   ▼
┌─────────────────────────────────────────────┐
│           MARKET REGISTRY (dynamic)         │
│  Every market has an id + spec              │
│                                             │
│  Static markets (always available):         │
│    "btc_usd_10m"  → BTC/USD, 10-min ticks  │
│    "eth_usd_10m"  → ETH/USD, 10-min ticks  │
│    "aapl_close"   → AAPL daily close        │
│                                             │
│  Dynamic markets (issuers auto-update):     │
│    "poly_*"       → new polymarket markets  │
│    "twitch_*"     → live twitch streams     │
│    "weather_*"    → active weather stations │
│  ...50,000+ markets, growing automatically  │
└──────────────────┬──────────────────────────┘
                   │ anyone picks market ids
                   ▼
┌─────────────────────────────────────────────┐
│           BATCHES (on-chain, perpetual)     │
│  batch = [market_ids] + resolution types    │
│  permissionless creation, runs forever      │
│  creator can update market_ids after current │
│  tick resolves (never mid-tick, trust-based) │
└─────────────────────────────────────────────┘
                   │ users join anytime with bitmap
                   ▼
┌─────────────────────────────────────────────┐
│              POOL VAULT (on-chain)          │
│  collateral lock, bitmap hash, claims       │
└─────────────────────────────────────────────┘
```

## Resolution Types

Each market in a batch has a resolution type (uint8).

```
ID   Name      Meaning                         Win %
──   ────      ───────                         ─────
0    up_0      price went up (any amount)       ~50%
1    up_30     price went up ≥ 30%              ~15%
2    up_x      price went up ≥ x% (custom)     varies
3    down_0    price went down (any amount)     ~50%
4    down_30   price went down ≥ 30%            ~15%
5    down_x    price went down ≥ x% (custom)   varies
6    flat_0    price unchanged (±0.1%)          ~5%
7    flat_x    price within ±x%                 varies
```

## Stale Price Cancellation

```
Tick N resolves:
  Issuers check: was market X's price updated since tick opened?

  YES → resolve normally
  NO  → market X CANCELLED for this tick only
        all bettors refunded their stake for that sub-market
        no winners/losers — treated like "all losers" per market
        BLS-signed cancellation set
```

## Rolling Participation

Batches are **perpetual**. No start/end. Anyone joins whenever they want.

```
Batch "Crypto 3-pack" — runs forever, 10-min ticks

tick:  0   1   2   3   4   5   6   7   8   9   10  11  ...
       │───│───│───│───│───│───│───│───│───│───│───│───│──→

Alice: ├───────────────────────┤                          joined tick 0, 6 ticks
Bob:   ├───────────────────────┤                          joined tick 0, 6 ticks
Carol:         ├───────────────────────┤                  joined tick 2, 6 ticks
Dave:                      ├───────────────────────┤      joined tick 4, 6 ticks
Eve:                               ├───────────────────  joined tick 6, 6 ticks
```

At any given tick, the pool = everyone whose window includes that tick.

```
Tick 3 pool: Alice + Bob + Carol          (3 players)
Tick 5 pool: Alice + Bob + Carol + Dave   (4 players)
Tick 7 pool: Carol + Dave + Eve           (3 players)
```

Pool size fluctuates. More players in a tick = bigger pot.

## Issuer Tick Resolution

Issuers compute everything per tick. They only store two things:

```
Per tick, issuers store:
  1. Resolution of each market  (uint8 result per market_id)
  2. Balance of each player     (USDC remaining after tick)

That's it. Everything else is derived.
```

```
Per tick computation:

1. List active players (balance > 0, bitmap covers this tick)

2. Compute each player's effective multiplier:
   mult = early_mult × commitment_mult
   early_mult      = 1 + min(time_before_tick, tick_duration)² / tick_duration²
   commitment_mult = log10(total_ticks_committed + offset)

   Both formulas are deployer-configured (set at deployment, immutable).
   Default offset = 9 → commitment_mult(1 tick) = log10(10) = 1.0

3. Compute tick stake per player:
   stake = fixed USDC per tick (set at join)

   effective_stake = stake × mult   ← multiplier scales cost AND payout weight
   balance ≥ effective_stake → normal bet, deducted
   balance > 0 but < effective_stake → partial bet (proportional weight)
   balance = 0              → excluded

4. Resolve each sub-market (price check + resolution type)

5. Compute payouts — winners split weighted by effective_stake:
   payout[i] = (effective_stake[i] / Σ effective_stake[winners]) × market_pot

6. Update balances (deduct stakes, add winnings)

7. BLS-sign: {tick_id, market_results[], player_balances[]}
```

Multipliers are double-edged: higher mult = more weight in the pot,
but also burns through balance faster.

```
Example — deposit 100 USDC each

Alice: 5 USDC/tick, committed 1000 ticks, submitted 2 days ago
  stake           = 5 USDC
  commitment_mult = log10(1009) = 3.0
  early_mult      = 2.0
  total mult      = 6.0
  effective_stake  = 5 × 6.0 = 30 USDC/tick  ← burns fast, wins big

Bob: 2 USDC/tick, committed 6 ticks, submitted 1 min ago
  stake           = 2 USDC
  commitment_mult = log10(15) = 1.18
  early_mult      = 1.01
  total mult      = 1.19
  effective_stake  = 2 × 1.19 = 2.38 USDC/tick  ← burns slow, wins small

If both win same market:
  Alice payout share = 30 / (30 + 2.38) = 93%
  Bob   payout share = 2.38 / (30 + 2.38) = 7%
```

## Protocol Fee

0.3% on all withdrawals (claims + early exits). Deducted at the contract level
when USDC leaves the PoolVault. No fee on deposits, no fee on internal
balance updates between ticks.

## All Losers = Refund

If a sub-market in a tick has **zero winners**, everyone gets their
share back for that sub-market. No pot rollover, no protocol take.

```
Tick 5, SOL market (up_30): SOL only went up 2%, threshold was 30%
  → everyone bet wrong, nobody meets threshold
  → all players refunded their SOL sub-market share
```

## Early Multiplier

Based on how far ahead of each batch tick your bitmap was already on-chain.

```
early_mult(tick) = 1 + min(time_before_tick, tick_duration)² / tick_duration²

  Capped at 2.0 — any submission ≥ 1 tick_duration ahead gets max mult.

  Bitmap on-chain 10 min before tick (= tick_duration) → mult = 2.0
  Bitmap on-chain 5 min before tick                    → mult = 1.25
  Bitmap on-chain 1 min before tick                    → mult = 1.01
  Not on-chain by tick                                 → auto-lose
```

Same mult applies to every tick your bitmap covers. Pre-commit ≥ 1 tick
ahead = max mult on all your ticks.

```
Alice submits 1000-tick bitmap on Monday
  → tick on Tuesday:  mult ≈ 2.0 (submitted 24h ago)
  → tick on Friday:   mult ≈ 2.0 (submitted 4 days ago)
  → all her ticks get max weight

Bob submits 6-tick bitmap 2 min before his first tick
  → tick 1: mult ≈ 1.04
  → tick 2-6: mult ≈ 2.0 (now 10+ min ahead)
```

## Bitmap Storage (gas-efficient)

Each bit = 1 prediction per market per tick (e.g. 1 = outcome happens,
0 = doesn't). Custom thresholds (up_x, down_x, flat_x) are defined in
the batch's resolution type config, not in the bitmap — always 1 bit
per market.

Encoding order: tick-major — all markets for tick 0, then all markets
for tick 1, etc. If the user encodes in wrong order, predictions are
misinterpreted and treated as losses. Encoding correctness is the
user's responsibility.

```
Flow:
  1. User sends bitmap to issuer nodes (REST/P2P)
  2. Issuers store bitmap, verify hash, gossip to peers
  3. User submits keccak256(bitmap) on-chain (commitment proof)
  4. Issuers verify: stored bitmap hash == on-chain hash

On-chain: only keccak256(bitmap) — 32 bytes, 1 storage slot.
Bitmap never touches the chain.

Gas comparison (100 markets × 1000 ticks = 12.5 KB bitmap):

  Full storage:  12,500 / 32 × 20,000 = ~7.8M gas  ← expensive
  Hash + event:  20,000 + 12,500 × 16  = ~220K gas  ← old approach
  Hash only:     ~40K gas                            ← current approach

joinBatch() stores:
  - keccak256(bitmap)     → 1 slot  (20K gas)
  - player address        → already in msg.sender
  - start tick, duration  → 1 slot  (20K gas)

No event emitted — issuers already have the bitmap.
If dispute: any issuer holding the bitmap can prove it matches the on-chain hash.
```

## Example: Tick 5 Resolution

```
Batch "Crypto 3-pack": [btc_usd_10m(up_0), eth_usd_10m(down_0), sol_usd_10m(up_30)]

Active players at tick 5: Alice, Bob, Carol, Dave  (4 players, all stake 1 USDC/tick)

Multipliers (offset=9):
  Alice: early 2.0 × commit log10(109) ≈ 2.04 → mult 4.08 → eff_stake 4.08
  Bob:   early 2.0 × commit log10(109) ≈ 2.04 → mult 4.08 → eff_stake 4.08
  Carol: early 1.5 × commit log10(15)  ≈ 1.18 → mult 1.77 → eff_stake 1.77
  Dave:  early 1.25 × commit log10(15) ≈ 1.18 → mult 1.48 → eff_stake 1.48

Total effective stake: 11.41
Per market pot: 11.41 / 3 = 3.80

Results: BTC +2%, ETH -1%, SOL +2% (below 30% threshold)

BTC (up_0, result=up):
  Alice bet 1 ✓ (weight 1.36)    Bob bet 1 ✓ (weight 1.36)
  Carol bet 0 ✗                   Dave bet 1 ✓ (weight 0.49)
  Winners total: 3.21
  Payout: Alice 1.61, Bob 1.61, Dave 0.58

ETH (down_0, result=down):
  Alice bet 1 (up) ✗              Bob bet 0 (down) ✓ (weight 1.36)
  Carol bet 1 (up) ✗              Dave bet 0 (down) ✓ (weight 0.49)
  Winners total: 1.85
  Payout: Bob 2.79, Dave 1.01

SOL (up_30, result=+2%, below threshold):
  ALL LOSERS → everyone refunded their per-market effective_stake

Net this tick:
  Alice: -4.08 paid, +1.61 BTC + 1.36 SOL refund = -1.11
  Bob:   -4.08 paid, +1.61 BTC + 2.79 ETH + 1.36 SOL refund = +1.68
  Carol: -1.77 paid, +0.59 SOL refund = -1.18
  Dave:  -1.48 paid, +0.58 BTC + 1.01 ETH + 0.49 SOL refund = +0.60
  Total in = total out (zero-sum)
```

## Entry Flow

```
User joins anytime:
  ├── picks: batch_id
  ├── deposits: any amount of USDC
  ├── sets: fixed USDC stake per tick (e.g. 2 USDC)
  ├── sends: bitmap to issuer nodes (REST/P2P)
  └── sends: bitmap hash on-chain (commitment proof, ~40K gas)
              plays until deposit runs out
              no upfront tick count validation
```

## Strategy System

Strategies run **user-side** (local Python on user's machine). Frontend is
a data pipe, not an executor. Bots call the data-node API directly and
submit bitmaps without the UI.

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────┐
│   DATA NODE     │────→│   FRONTEND           │────→│  CHAIN  │
│   /snapshot     │ JSON│   passes data to     │ tx  │  bitmap │
│   10k markets   │     │   user's script      │     │  hash   │
└─────────────────┘     └──────────┬───────────┘     └─────────┘
                                   │ data in
                                   ▼
                        ┌──────────────────────┐
                        │  USER'S PYTHON SCRIPT │
                        │                      │
                        │  def strategy(markets):
                        │    bits = []         │
                        │    for m in markets:  │
                        │      if m.change_24h > 0:
                        │        bits.append(1)│
                        │      else:           │
                        │        bits.append(0)│
                        │    return bits        │
                        │                      │
                        │  OUTPUT: bitmap       │
                        └──────────────────────┘
```

Data available to scripts (from snapshot):
```python
class Market:
    id: str          # "btc_usd_10m"
    cat: str         # "crypto"
    source: str      # "crypto"
    price: float     # 98400.0
    change_24h: float # +2.1
    change_7d: float  # -1.3
    volume: float    # 1.2e9
    mcap: float      # 1.9e12
```

Templates = pre-written python scripts with backtest stats.
Users fork and modify. Bots skip UI entirely.

## UI — Main Page

Cards grid with live animated headers. Click a card → expands inline.

```
┌─────────────────────────────────────────────────────────────┐
│ VISION                          142 live · $312k TVL        │
│                                                             │
│ ┌─────────────────────────┐ ┌─────────────────────────┐     │
│ │▓░▓▓░▓▓▓░░▓▓▓▓░▓░▓▓▓▓░▓│ │░░▓░░░▓▓░░▓░░░▓░▓░░▓▓░░│     │
│ │▓▓░▓▓░░▓▓▓░▓▓░▓▓░▓░▓▓░▓│ │▓░░▓░▓░░▓░░▓▓░░▓░░▓░▓▓░│     │
│ │░▓▓░▓▓▓░▓░▓▓▓░▓▓▓░▓▓░▓▓│ │░▓░░▓░▓▓░▓░░▓▓░▓▓░░▓░▓░│     │
│ │ Crypto Top 10           │ │ Polymarket Hot 50       │     │
│ │ 10 mkts · up_0 · 10min │ │ 50 mkts · up_0 · 10min │     │
│ │ 340 players · $12.4k    │ │ 128 players · $9.2k     │     │
│ └─────────────────────────┘ └─────────────────────────┘     │
│                                                             │
│ ┌─────────────────────────┐ ┌─────────────────────────┐     │
│ │ ▁▃▅▇▅▃▁▃▅▇▅▃▁▃▅▇▅▃▁▃▅ │ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│     │
│ │ ▅▇▅▃▁▃▅▇█▇▅▃▁▃▅▇▅▃▁▃▅ │ │▓▓▓░░░▓▓▓▓░░▓▓▓░▓▓▓▓░░▓│     │
│ │ Meme 5                  │ │ Everything (10k)        │     │
│ │ 5 mkts · 52 ppl · $2.1k│ │ 10k mkts · 89 ppl · $22k│     │
│ └─────────────────────────┘ └─────────────────────────┘     │
│                                                             │
│ [ + CREATE BATCH ]                          [ LOAD MORE ]   │
└─────────────────────────────────────────────────────────────┘
```

Card header types auto-generated by batch content:

```
≤5 markets     large sparklines        6-20 markets   mini bar grid
21-100 mkts    result heatmap          100+ mkts      bitmap mosaic
weather        temp/metric bars        polymarket     odds shift bars
```

## UI — Expanded Batch (click card)

Card expands inline. Two tabs: **VISUAL** and **SCRIPT**.
Adapts to batch size automatically.

```
Batch size        Default tab
─────────        ───────────
≤ 20 mkts        VISUAL — click cards ▲/▼, scrollable with bar charts
21-100 mkts      VISUAL — compact toggleable rows with mini charts
100+ mkts        SCRIPT — python editor (visual not practical)
```

### Visual Tab (≤20 markets)

```
┌─────────────────────────────────────────────────────────────┐
│ Crypto Top 10         tick #841     00:04:12    [VISUAL][SCRIPT]
│ 10 mkts · up_0 · 10min · 340 players · $12.4k TVL          │
│                                                             │
│ ── Markets (scroll →) ────────────────────────────────────  │
│                                                             │
│      BTC        ETH        SOL        BNB        XRP        │
│    $98,400    $3,841      $187       $612       $0.58       │
│    ▇         ▅▇          ▇           ▅          ▃          │
│    ▅▇        ▃▅▇         ▅▇          ▃▅         ▁▃         │
│    ▃▅▇       ▁▃▅         ▃▅▇         ▁▃▅        ▃▁▃        │
│    ▁▃▅       ▃▁▃         ▁▃▅▇        ▃▁▃        ▅▃▁        │
│    +2.1%     -0.3%       +5.4%       +0.8%      -1.2%      │
│   [▲ UP]    [▼ DOWN]    [▲ UP]      [▲ UP]     [▼ DOWN]    │
│                                                             │
│              ◄ scroll for ADA, DOGE, AVAX, DOT, LINK ►     │
│                                                             │
│ ── Your History ──────────────────────────────────────────  │
│                                                             │
│ BTC  ✓✓✗✓✓✓✗✓✓✓✓✗✓✓✓✗✓✓✓✓ │▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲        │
│ ETH  ✗✓✓✗✓✗✓✓✗✓✓✓✗✓✓✗✓✓✗✓ │▼▲▼▼▲▲▼▲▼▲▼▲▲▼▲▲▼▲▼▲        │
│ SOL  ✓✓✓✓✗✓✓✓✓✓✗✓✓✓✓✗✓✓✓✓ │▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲        │
│      ↑ past (scroll)        ↑now  ↑ future bets            │
│                                                             │
│ Win: 68% │ Balance: 47.3 USDC │ Stake: 2 USDC │ Mult: 2.0x │
│                                                             │
│ [ ALL ▲ ] [ ALL ▼ ] [ DEPOSIT ] [ WITHDRAW ] [ SUBMIT ]    │
└─────────────────────────────────────────────────────────────┘
```

### Visual Tab — Compact Rows (21-100 markets)

```
┌─────────────────────────────────────────────────────────────┐
│ DeFi Blue Chips (40)    tick #841   00:04:12  [VISUAL][SCRIPT]
│                                                             │
│  ▲ AAVE    $312   +4.2%  ▁▃▅▇▅    ✓✓✗✓✓ │▲▲▲▲▲▲▲▲▲▲      │
│  ▼ UNI     $12.4  -1.1%  ▅▃▁▃▅    ✗✓✓✗✓ │▼▼▼▼▼▼▼▼▼▼      │
│  ▲ MKR     $2,100 +2.8%  ▃▅▇▅▃    ✓✓✓✗✓ │▲▲▲▲▲▲▲▲▲▲      │
│  ▲ CRV     $0.82  +6.1%  ▁▃▅▇█    ✓✓✓✓✗ │▲▲▲▲▲▲▲▲▲▲      │
│  ▼ COMP    $58    -0.3%  ▅▃▁▁▃    ✗✗✓✗✓ │▼▼▲▼▲▲▼▼▲▼      │
│  ... (scrollable)                                           │
│                                                             │
│  32▲ 8▼  [ ALL ▲ ] [ ALL ▼ ] [ FLIP ALL ]    [ SUBMIT ]   │
└─────────────────────────────────────────────────────────────┘
```

### Script Tab

Available on any batch. Default for 100+ markets.
Python editor + templates + backtest.

```
┌─────────────────────────────────────────────────────────────┐
│ Everything (10k)        tick #841   00:04:12  [VISUAL][SCRIPT]
│                                                             │
│ TEMPLATES                                                   │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐  │
│ │ Momentum   │ │ Bear All   │ │ Random     │ │ Custom   │  │
│ │ 54% win    │ │ 48% win    │ │ 51% win    │ │          │  │
│ │ 3.0k uses  │ │ 890 uses   │ │ 1.4k uses  │ │ [EDIT]   │  │
│ └────────────┘ └────────────┘ └────────────┘ └──────────┘  │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ def strategy(markets):                                │   │
│ │     bits = []                                         │   │
│ │     for m in markets:                                 │   │
│ │         if m.change_24h > 0:                          │   │
│ │             bits.append(1)                            │   │
│ │         else:                                         │   │
│ │             bits.append(0)                            │   │
│ │     return bits                                       │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ [RUN PREVIEW]  Result: 5,412▲ 4,588▼                        │
│ Backtest 100 ticks: 54% win                                 │
│ ▁▃▅▆▄▇▅▃▆▇▅▄▆▃▅▇▆▅▃▄▆▅▇▆▄▃▅▆▇▅▄▃▆▅▇▆▄▃▅▇▆▅▃▄▆▅▇▆▄▃▅    │
│                                                             │
│ Win: 52% │ Balance: 183 USDC │ Stake: 2 USDC │ Mult: 1.8x │
│                                                             │
│ [ SAVE TEMPLATE ] [ DEPOSIT ] [ WITHDRAW ] [ SUBMIT ]       │
└─────────────────────────────────────────────────────────────┘
```

### Page Flow

```
User lands on page
  │
  ▼ sees cards grid (all batches)
  │
  ├── clicks any card → card expands inline
  │     │
  │     ├── ≤20 mkts  → opens on VISUAL tab (card grid)
  │     ├── 21-100    → opens on VISUAL tab (compact rows)
  │     └── 100+      → opens on SCRIPT tab
  │     │
  │     ├── [VISUAL] / [SCRIPT] tabs to switch anytime
  │     ├── [SUBMIT] → submit bitmap + deposit
  │     ├── [DEPOSIT] / [WITHDRAW] → manage collateral
  │     └── click card header again → collapse, back to grid
  │
  └── [ + CREATE BATCH ] → batch creation flow
```

## Key Properties

| Property | Value |
|---|---|
| **Model** | P2Pool — compete within your batch only |
| **Lifecycle** | Perpetual rolling — anyone joins anytime, plays until deposit runs out |
| **Markets** | Global dynamic registry, governed by issuer nodes |
| **Batches** | Permissionless, no creator fees, market updates only after tick resolves |
| **Resolution** | uint8 type per market: up_0, up_30, down_x, flat_x, etc. |
| **Scale** | 100k+ bets per bitmap (100 markets × 1000 ticks = 12.5 KB) |
| **Collateral** | USDC deposit, fixed stake per tick (set at join) |
| **Entry** | Bitmap to issuers + 1 tx: deposit + stake config + hash (~40K gas) |
| **Early mult** | `1 + min(t, tick_dur)² / tick_dur²` — capped at 2.0, pre-commit = max weight |
| **Stale prices** | Issuer cancels sub-market for that tick, bettors refunded per market |
| **All losers** | Everyone refunded their share for that sub-market |
| **Claim** | Verified against issuer BLS aggregated signature |
| **Protocol fee** | 0.3% on all withdrawals (claims + exits) |
| **Exit** | `withdraw()` anytime; `pause()` + `forceWithdraw()` by issuers |
| **Target users** | Bots / AI agents ultimately, with strategy preset UX for humans |

## Contracts

```
BatchRegistry (on-chain)
  - createBatch(marketIds[], resolutionTypes[]) → batchId
  - updateBatchMarkets(batchId, marketIds[], resolutionTypes[])
      ^ creator only, trust-based
      ^ only callable after current tick resolves (never mid-tick)
  - getBatch(batchId) → {marketIds, resolutionTypes, tickDuration}

PoolVault (on-chain)
  - joinBatch(batchId, stakePerTick, bitmapHash) + deposit
      ^ stores hash + stake config (2 slots)
  - claimRewards(batchId, tickRange, issuerBLSSig)
      ^ player collects BLS sigs from issuers, aggregates, submits tx
      ^ verified against issuer BLS aggregated pubkey
      ^ 0.3% protocol fee deducted on withdrawal
  - withdraw(batchId)
      ^ player exits, claims remaining balance
      ^ 0.3% protocol fee deducted
  - pause(batchId) — issuer-only
      ^ freezes all activity on a batch
  - forceWithdraw(batchId, player) — issuer-only
      ^ returns player's remaining balance (minus fee)
      ^ emergency use: stuck funds, malicious batches

BotRegistry → stays (peer discovery)

Market Registry (off-chain JSON, issuer-governed)
  - All available markets with id, spec, source, resolution method
  - Issuers sign updates via BLS consensus
```
