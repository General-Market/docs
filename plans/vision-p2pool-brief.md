# Vision P2Pool Brief

## Architecture

```
┌─────────────────────────────────────────────┐
│              ORACLE NODES (BLS)             │
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
│  Dynamic markets (oracles auto-update):     │
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
  Oracles check: was market X's price updated since tick opened?

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

## Oracle Tick Resolution

Oracles compute everything per tick. They only store two things:

```
Per tick, oracles store:
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

5. Per sub-market, apply side matching:
   UP_total  = Σ per_market_eff_stake for UP bettors
   DOWN_total = Σ per_market_eff_stake for DOWN bettors
   matched = min(UP_total, DOWN_total)

   Larger side → matched_stake[i] = stake[i] × (matched / side_total)
   Smaller side → matched_stake[i] = stake[i]
   Refund[i] = stake[i] - matched_stake[i]

   Winners: payout = matched_stake × (1 + opposing / winning_side_matched)
   Losers: lose matched_stake
   All: get refund back

6. Verify bitmaps in 10-min reveal window (non-revealed = void)

7. Update balances (deduct matched stakes, add winnings + refunds)

8. BLS-sign: {tick_id, market_results[], player_balances[]}
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

## Design Principles

```
Target users: quant funds, market makers, bots
Model: sealed parimutuel (like Polymarket odds, but hidden until reveal)

REWARD:
  Accuracy     — correct predictions profit. Same as Polymarket: buy cheap side, collect $1.
  Capital      — bigger stake = bigger absolute PnL. Linear scaling within matched bounds.
  Contrarian   — minority side gets better return rate (parimutuel). Hidden odds = alpha.
  Early commit — multiplier rewards pre-commitment (already in place).

PROTECT:
  Whale safety — max loss bounded by opposing side's capital. Excess refunded.
  Privacy      — bitmaps sealed during tick. Strategies can't be copied.
  Predictable  — deterministic formula. Bots can model EV precisely.

PUNISH:
  Free-riding  — $1 can't extract $1M. Side matching caps it.
  Lazy capital — majority side earns low returns (parimutuel).
```

## Side Matching (Whale Safety)

Per sub-market, the two sides (UP vs DOWN) are matched at the aggregate level.
Unmatched excess on the heavier side is refunded. This is how parimutuel odds
work in Polymarket — you can't win more than the opposing side put up — but
applied post-tick because bitmaps are sealed.

```
Per sub-market, per tick:

  UP_total   = Σ eff_stake_per_market[i]  for all players who bet 1 (UP)
  DOWN_total = Σ eff_stake_per_market[i]  for all players who bet 0 (DOWN)
  matched    = min(UP_total, DOWN_total)

  For each player i:
    if on larger side:
      matched_stake[i] = per_market_stake[i] × (matched / own_side_total)
      refund[i]        = per_market_stake[i] - matched_stake[i]
    if on smaller side (or equal):
      matched_stake[i] = per_market_stake[i]
      refund[i]        = 0

  Resolution:
    Winning side → payout[i] = matched_stake[i] × (1 + opposing_matched / winning_matched)
    Losing side  → payout[i] = 0  (loses matched_stake)
    Both sides   → refund[i] returned

  Special cases:
    All same side (no opponents)  → everyone refunded, no bet
    All losers (threshold unmet)  → everyone refunded
    Equal sides                   → no refund, pure double-or-nothing

  Equivalent to hidden Polymarket odds:
    minority_side_return = majority_total / minority_total  (> 100%)
    majority_side_return = minority_total / majority_total  (< 100%)
    A quant who can estimate the hidden ratio has alpha.
```

```
Properties:
  - O(N × M) per tick — sum each side per market, no sorting
  - Zero-sum per tick (total in = total out)
  - Max loss = min(your_stake, total_opposing_stake_in_that_market)
  - Max win = same bound
  - Whale excess capital always safe (refunded)
  - Minority side gets better odds (Polymarket-like)
  - Multiplier still works: higher mult = more weight within your side
```

## Bitmap Reveal Period

Bitmaps are sealed during the tick (privacy — strategies can't be copied).
After the tick resolves, a 10-minute reveal window opens.

```
Timeline:

  ──[tick N]──────[tick N ends]──[10 min reveal]──[final]──
       │              │                │              │
       │  bitmaps     │  oracles       │  all bitmaps │  BLS-sign
       │  private     │  resolve       │  published   │  balances
       │              │  prices        │  anyone can  │
       │              │                │  verify hash │

Rules:
  - Oracles publish all bitmaps they hold for that tick
  - Anyone can verify: keccak256(published_bitmap) == on-chain hash
  - If a player's bitmap is NOT revealed within 10 minutes:
    → treated as "did not bet" for that tick
    → no payout, no loss (stake refunded for that tick)
  - Oracles have the bitmap (received pre-tick), so reveal is automatic
    unless oracle nodes are down

Why:
  - Pre-tick: sealed → anti-copy, strategy privacy, bot competitive edge
  - Post-tick: revealed → transparency, verifiability, dispute resolution
  - 10-min window: gives oracles time to gossip and publish
  - Non-revealed = void: prevents selective reveal (only reveal if you won)
```

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
  1. User sends bitmap to oracle nodes (REST/P2P)
  2. Oracles store bitmap, verify hash, gossip to peers
  3. User submits keccak256(bitmap) on-chain (commitment proof)
  4. Oracles verify: stored bitmap hash == on-chain hash
  5. During tick: bitmaps private (anti-copy, strategy protection)
  6. After tick resolves: 10-min reveal — oracles publish all bitmaps
  7. Anyone verifies hash(bitmap) == on-chain hash
  8. Non-revealed within 10 min → void (treated as did not bet)

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

No event emitted — oracles already have the bitmap.
If dispute: any oracle holding the bitmap can prove it matches the on-chain hash.
```

## Example: Tick 5 Resolution (Side Matching)

```
Batch "BTC Single": [btc_usd_10m(up_0)]
4 players, different stakes:

  Alice: eff_stake $1,000 — bets UP
  Bob:   eff_stake $500   — bets DOWN
  Carol: eff_stake $200   — bets UP
  Dave:  eff_stake $100   — bets DOWN

Side matching:
  UP_total  = $1,000 + $200 = $1,200
  DOWN_total = $500 + $100  = $600
  matched = $600

  UP is larger → scale down:
    Alice matched = $1,000 × ($600/$1,200) = $500    refund = $500
    Carol matched = $200 × ($600/$1,200)   = $100    refund = $100
  DOWN fully matched:
    Bob   matched = $500    refund = $0
    Dave  matched = $100    refund = $0

  Hidden odds (revealed post-tick):
    UP return if UP wins:  $600/$1,200 = 50%  (like buying YES at $0.67)
    DOWN return if DOWN wins: $1,200/$600 = 100% (like buying YES at $0.50)

Result — BTC went UP:
  Alice: $500 matched × (1 + 600/600) = $1,000 + $500 refund → net +$500
  Carol: $100 matched × (1 + 600/600) = $200   + $100 refund → net +$100
  Bob:   loses $500 matched                                   → net -$500
  Dave:  loses $100 matched                                   → net -$100
  Sum: +500 +100 -500 -100 = 0 ✓

Result — BTC went DOWN:
  Bob:   $500 matched × (1 + 600/600) = $1,000 → net +$500
  Dave:  $100 matched × (1 + 600/600) = $200   → net +$100
  Alice: loses $500 matched, keeps $500 refund  → net -$500
  Carol: loses $100 matched, keeps $100 refund  → net -$100
  Sum: +500 +100 -500 -100 = 0 ✓

Key: Alice put $1,000 but max loss = $500 (matched portion only).
```

## Example: Multi-Market Tick

```
Batch "Crypto 3-pack": [btc(up_0), eth(down_0), sol(up_30)]
4 players, eff_stake split equally across 3 markets:

  Alice $1,200 → $400/mkt   Bob $600 → $200/mkt
  Carol $300   → $100/mkt   Dave $300 → $100/mkt

           BTC    ETH    SOL
  Alice:    UP     UP     DOWN
  Bob:      UP     DOWN   DOWN
  Carol:    DOWN   UP     UP
  Dave:     UP     DOWN   UP

  Results: BTC +2% (up), ETH -1% (down), SOL +2% (below 30%)

BTC (up_0, result=UP):
  UP: Alice($400)+Bob($200)+Dave($100) = $700
  DOWN: Carol($100)
  matched = $100. UP excess $600 refunded proportionally.
  UP wins → winners gain $100 from Carol, split by matched weight.

ETH (down_0, result=DOWN):
  UP: Alice($400)+Carol($100) = $500
  DOWN: Bob($200)+Dave($100) = $300
  matched = $300. UP excess $200 refunded proportionally.
  DOWN wins → Bob and Dave split $300 from UP side.

SOL (up_30, +2% below threshold):
  ALL LOSERS → everyone refunded.

Each market resolves independently with its own side matching.
10-min reveal: all bitmaps published, hashes verified.
Final balances BLS-signed by oracles.
```

## Entry Flow

```
User joins anytime:
  ├── picks: batch_id
  ├── deposits: any amount of USDC
  ├── sets: fixed USDC stake per tick (e.g. 2 USDC)
  ├── sends: bitmap to oracle nodes (REST/P2P)
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
| **Model** | Sealed parimutuel P2Pool with side matching — compete within your batch |
| **Lifecycle** | Perpetual rolling — anyone joins anytime, plays until deposit runs out |
| **Markets** | Global dynamic registry, governed by oracle nodes |
| **Batches** | Permissionless, no creator fees, market updates only after tick resolves |
| **Resolution** | uint8 type per market: up_0, up_30, down_x, flat_x, etc. |
| **Scale** | 100k+ bets per bitmap (100 markets × 1000 ticks = 12.5 KB) |
| **Collateral** | USDC deposit, stake per tick (set at join), side-matched per market |
| **Whale safety** | Per-market side matching — excess refunded, max loss = opposing capital |
| **Privacy** | Bitmaps sealed during tick, 10-min reveal after resolution |
| **Entry** | Bitmap to oracles + 1 tx: deposit + stake config + hash (~40K gas) |
| **Early mult** | `1 + min(t, tick_dur)² / tick_dur²` — capped at 2.0, pre-commit = max weight |
| **Stale prices** | Oracle cancels sub-market for that tick, bettors refunded per market |
| **All losers** | Everyone refunded their share for that sub-market |
| **Claim** | Verified against oracle BLS aggregated signature |
| **Protocol fee** | 0.3% on all withdrawals (claims + exits) |
| **Exit** | `withdraw()` anytime; `pause()` + `forceWithdraw()` by oracles |
| **Target users** | Quant funds, market makers, bots — with strategy preset UX for humans |

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
  - claimRewards(batchId, tickRange, oracleBLSSig)
      ^ player collects BLS sigs from oracles, aggregates, submits tx
      ^ verified against oracle BLS aggregated pubkey
      ^ 0.3% protocol fee deducted on withdrawal
  - withdraw(batchId)
      ^ player exits, claims remaining balance
      ^ 0.3% protocol fee deducted
  - pause(batchId) — oracle-only
      ^ freezes all activity on a batch
  - forceWithdraw(batchId, player) — oracle-only
      ^ returns player's remaining balance (minus fee)
      ^ emergency use: stuck funds, malicious batches

BotRegistry → stays (peer discovery)

Market Registry (off-chain JSON, oracle-governed)
  - All available markets with id, spec, source, resolution method
  - Oracles sign updates via BLS consensus
```
