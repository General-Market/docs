# DIAGRAM PLAN — Animated Schematics Everywhere

Every 3 seconds must have an active animated diagram. Not text overlays — VISUAL EXPLANATIONS.

The talking head occupies center. Diagrams fill the remaining space: left panel, right panel, lower third, or full-screen with transparent face area.

## Layout Zones

```
┌─────────────────────────────────────────┐
│  ZONE A (top bar)                       │
│  Labels, counters, status               │
├──────────┬──────────────┬───────────────┤
│          │              │               │
│  ZONE B  │   FACE       │   ZONE C      │
│  (left)  │   (center)   │   (right)     │
│  diagrams│   untouched  │   diagrams    │
│          │              │               │
├──────────┴──────────────┴───────────────┤
│  ZONE D (lower third)                   │
│  Timelines, flows, annotations          │
└─────────────────────────────────────────┘
```

Face safe zone: 35%-65% horizontal, 20%-80% vertical. Everything else is diagram space.

## Parasite Text Rules

Every diagram gets floating annotation labels:
- Connected to elements by thin lines (leader lines)
- Small mono text, uppercase, tracking 0.06em
- Appear 0.3s after their parent element
- Subtle pulse on first appearance
- Stay visible while parent diagram is on screen

---

## SECTION 1: HOOK (0.0s–42.8s) — Agent 1

### 0.0–3.4s: Title + Bot Pipeline
**ZONE D**: Animated pipeline schematic:
```
[YOU] ──→ [CLAUDE CODE] ──→ [BOT] ──→ [GM PLATFORM] ──→ [500K MARKETS]
```
5 rounded boxes connected by animated arrows (dash-offset flow). Each box springs in L→R with 0.3s stagger. Boxes have icons inside (person, terminal, robot, logo, grid).
**Parasite labels**: "prompt", "strategy", "API", "execution", "settlement" on each arrow.

### 3.4–11.3s: Anti-Pattern + Disclaimer
**ZONE C** (right panel): Mock trading guru card with red X stamp, then dissolves.
**ZONE B** (left panel): "This video:" checklist — "❌ Get rich quick" crossed, "✓ Understand the system" green.

### 11.3–22.2s: Problem Constellation
**ZONE B+C** (both sides): Three interconnected problem nodes forming a triangle:
```
        [LIQUIDITY]
       /            \
      /              \
[CAPITAL LOCK] ── [RISK MGMT]
```
Each node: circle with icon + label. Red pulsing connections between them. As speaker names each, that node zooms and highlights. 
**Parasite labels**: "orderbook depth", "lock period", "counterparty exposure" branching off each node.
After all three named → green solution arrow appears pointing down to "GENERAL MARKET" box.

### 22.2–34.1s: Trade Execution Flow
**ZONE D**: Horizontal process flow, 6 steps:
```
[STRATEGY] → [SIGNAL] → [ORDER] → [EXECUTION] → [SETTLEMENT] → [PNL]
         red X ─────────┘        red X ─────────┘
```
Steps 3 and 5 get red X markers (the pain points). Then green bypass arrows appear showing GM's path around them.
**Parasite labels**: "slippage", "front-running" on the X markers. "Parimutuel", "10 min" on green bypasses.

### 34.1–42.8s: Audience + Transition
**ZONE B**: Profile card "RETAIL" with simplified stats
**ZONE C**: Profile card "FUND MANAGER" with fund stats  
Both get green checkmarks. Then both cards shrink and move to corners as transition to terminal.

---

## SECTION 2: BOT TRIGGER (42.8s–57.8s) — Agent 2

### 42.8–48.6s: Terminal + System Architecture
**ZONE C**: Terminal (existing, keep it)
**ZONE B** (left panel): Real-time system architecture diagram:
```
┌─────────────┐
│  YOUR BOT   │
│  (Claude)   │
└──────┬──────┘
       │ WebSocket
┌──────▼──────┐
│  GM API     │
│  /submit    │
└──────┬──────┘
       │
┌──────▼──────┐     ┌──────────┐
│ BATCH ENGINE│────▶│ ORACLE x3│
│ (L3 chain)  │     │ (BLS)    │
└──────┬──────┘     └──────┬───┘
       │                    │
       └────────┬───────────┘
          ┌─────▼─────┐
          │ SETTLEMENT│
          │ (10 min)  │
          └───────────┘
```
Boxes draw themselves (strokeDashoffset), connections animate top-down. Each layer has a subtle different bg tint.
**Parasite labels**: "authenticated", "batch ID", "consensus", "PNL distributed" on connections.

### 48.6–57.8s: FAQ Overview
**ZONE D**: Numbered question list (1-5) as a horizontal tab bar. #1 pulses. Side: animated counter spinning to "500,000".
**ZONE B**: System architecture stays but dims to 30% opacity as background reference.

---

## SECTION 3: FAQ 1 — LIQUIDITY (57.8s–89.8s) — Agent 3

### 57.8–62.4s: Batch Anatomy
**ZONE B+C** (wide): Batch structure schematic:
```
┌─── BATCH: Twitch Viewers ─────────────────────┐
│ Source: Twitch API          Tick: 10 min       │
│ Assets: 5,000 streamers    Type: Viewer Count  │
├────────────────────────────────────────────────┤
│ Submarket 1: xQc          [YES] [NO]          │
│ Submarket 2: pokimane     [YES] [NO]          │
│ Submarket 3: shroud       [YES] [NO]          │
│ ...                                            │
│ Submarket 5000: user_xyz  [YES] [NO]          │
├────────────────────────────────────────────────┤
│ Settlement: Parimutuel    Oracle: 3-node BLS   │
└────────────────────────────────────────────────┘
```
Rows scroll/reveal progressively. YES/NO cells have green/red micro-fills.
**Parasite labels**: "5000 simultaneous markets", "one batch = one bet" on edges.

### 62.4–72.1s: Mandatory Fill Network
**ZONE B**: Traditional model — single arrow from trader to 1 market:
```
[TRADER] ──→ [Market A]
             [Market B] (grey)
             [Market C] (grey)
```
**ZONE C**: GM model — mesh network, trader connected to ALL:
```
         ┌──→ [A]
[TRADER] ├──→ [B]
         ├──→ [C]
         └──→ [... 5000]
```
Arrows animate simultaneously (the point). Green glow on GM side.
Animated: arrows draw one-by-one (traditional) vs ALL AT ONCE (GM).
**Parasite labels**: "pick one" (traditional), "mandatory fill: ALL" (GM), "= guaranteed liquidity".

### 72.1–84.8s: Coverage + Benefit
**ZONE D**: Animated heatmap comparison:
- Left grid (10x10): only 3-5 cells green, rest grey. Label: "Traditional: ~5% coverage"
- Right grid (10x10): ALL cells green, pulsing. Label: "GM: 100% coverage"
Counter below: "Active markets: 5 / 100" vs "Active markets: 5000 / 5000"
**Parasite labels**: "dead liquidity", "no gaps", "every streamer traded".

### 84.8–89.8s: Skill Distribution
**ZONE B+C**: Animated bell curve (SVG path drawing itself):
- X-axis: "PNL"
- Y-axis: "Traders"  
- Left tail red, center grey, right tail green
- Annotation arrows: "Skill edge separates winners" pointing to right tail
**Parasite label**: "Same rules for everyone. Skill is the only variable."

---

## SECTION 4: FAQ 2 — SETTLEMENT (89.8s–161.4s) — Agent 4 + Agent 5

### Agent 4: Settlement Pipeline (89.8s–131.5s)

### 89.8–96.4s: Train Delay Intro
**ZONE B**: FAQ tab bar, #2 active.
**ZONE C**: Germany rail schematic — simplified map outline with 30 dots:
```
       Hamburg •
              \
    Hannover • ── Berlin •
              |
  Köln • ── Frankfurt •
              |
         Stuttgart •
              |
          München •
```
Dots light up green with stagger as speaker says "30 stations". Rail lines draw between them.
**Parasite labels**: Station names on dots. "30 submarkets" label.

### 96.4–113.8s: The 10-Min Cycle
**ZONE D** (full-width lower third): Animated timeline with 3 phases:
```
|←── BETTING WINDOW (10 min) ──→|←── ORACLE ──→|←── SETTLE ──→|
[=========BETS FLOWING IN========][===COMPUTE===][==$$ PAID$$==]
0:00                            10:00          10:30          11:00
```
Progress bar fills left→right in real-time sync with speech.
During betting phase: animated order blocks dropping in from top (green=YES, red=NO) like Tetris.
During oracle phase: 3 node icons pulse, connection lines form.
During settle phase: $ signs flow outward.
**Parasite labels**: "sealed", "BLS consensus", "parimutuel engine", "instant withdrawal".

### 113.8–126.1s: Oracle Deep Dive
**ZONE B+C** (wide): Full oracle architecture:
```
┌──────────────────────────────────────────────┐
│              DATA FEEDS                       │
│  [Twitch API] [DB API] [Steam API] [...]     │
└──────────┬───────────────────┬───────────────┘
           │                   │
    ┌──────▼──────┐     ┌─────▼──────┐     ┌──────────┐
    │  ORACLE 1   │     │  ORACLE 2  │     │ ORACLE 3 │
    │  Compute    │     │  Compute   │     │ Compute  │
    │  Sign (BLS) │     │  Sign (BLS)│     │ Sign(BLS)│
    └──────┬──────┘     └──────┬─────┘     └────┬─────┘
           │                   │                 │
           └───────────┬───────┘─────────────────┘
                       │ Aggregated BLS Signature
                ┌──────▼──────┐
                │ SMART       │
                │ CONTRACT    │
                │ (verify +   │
                │  settle)    │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │ PNL         │
                │ DISTRIBUTED │
                └─────────────┘
```
Each tier animates top-down. BLS signature lines converge to single point (aggregation visual).
**Parasite labels**: "independent computation", "threshold consensus", "on-chain verification", "atomic settlement".

### 126.2–131.5s: No Price Reveal
**ZONE B+C**: Price comparison split:
- **Left**: Traditional candle chart (animated candles drawing). Label: "Continuous price discovery"
- **Right**: Flat line → single settlement dot. Label: "Result revealed at end"
Big text overlay: "NO ORDERBOOK. NO PRICE."
**Parasite labels**: "no front-running", "no MEV", "no manipulation".

### Agent 5: Parimutuel + Risk (131.5s–161.4s)

### 131.5–142.4s: Parimutuel Engine
**ZONE B+C** (wide): Full parimutuel computation visual:
```
┌─── SUBMARKET: Berlin Hbf ──────────────────┐
│                                             │
│  YES POOL        │        NO POOL           │
│  ████████ $800   │   ████████████ $1200     │
│                  │                          │
│  Result: YES ✓   │                          │
│                  │                          │
│  YES bettors win:│                          │
│  $1200 / 8 = $150│each (from NO pool)      │
└─────────────────────────────────────────────┘
```
Pool bars animate (fill up). Arrow from NO pool to YES pool (money flow). Numbers calculate live.
**Parasite labels**: "losers fund winners", "proportional to bet size", "zero-sum per submarket".

### 142.4–150.4s: 30x Computation Grid
**ZONE B+C**: 6×5 grid of mini-pool diagrams, each running simultaneously:
```
[Berlin ✓] [München ✗] [Hamburg ✓] [Frankfurt ✗] [Köln ✓] [Stuttgart ✓]
[Nürnberg✗] [Dresden ✓] [...] [...] [...] [...]
...
```
Each cell flashes green (YES won) or red (NO won). Results accumulate into:
**ZONE D**: PNL waterfall — 30 bars, some positive (green), some negative (red), cascading left→right. Final sum highlighted.
**Parasite labels**: "+$45", "-$12", "+$8"... on each bar. "Final PNL: +$127" at end.

### 150.4–161.4s: Risk Cap + Summary
**ZONE B**: Proportional matching schematic:
```
Trader A: $1    ──┐
                  ├── Matched: $1 vs $1
Trader B: $1M   ──┘
                      Unmatched: $999,999 returned
```
Arrow shows only $1 is at risk for the small trader. The $999,999 gets returned.
**ZONE C**: Settlement summary card (white, frontend style):
```
┌─────────────────────┐
│ SETTLEMENT COMPLETE │
│ ✓ 10 min cycle      │
│ ✓ $0 fees           │  
│ ✓ $0 spread         │
│ ✓ Risk capped       │
│ ✓ Instant withdraw  │
│ ✓ No disputes       │
└─────────────────────┘
```
Each row appears with checkmark animation.

---

## SECTION 5: FAQ 3 — PRIVACY (161.4s–194.0s) — Agent 6

### 161.4–170.4s: Order Book Transparency Problem
**ZONE B** (left): Animated traditional order book:
```
┌── ORDER BOOK (public) ──┐
│ BID          ASK        │
│ $0.52 (200)  $0.53 (150)│
│ $0.51 (500)  $0.54 (300)│
│ $0.50 (800)  $0.55 (100)│
│                         │
│ Recent trades:          │
│ Buy 100 @ $0.53 ← 0x4a│
│ Sell 50 @ $0.52 ← 0xb7│
└─────────────────────────┘
```
Orders flow in animated. Addresses visible.
**ZONE C**: Magnifying glass icon zooming into the order book → reveals "COPY TRADER" following orders.
**Parasite labels**: "your strategy: visible", "wallet: traceable", "copy trader: following you".

### 170.4–181.2s: GM Sealed Architecture  
**ZONE B** (left): GM sealed bet flow:
```
┌── GM BATCH (sealed) ────┐
│                         │
│ Bet 1: [ENCRYPTED]      │
│ Bet 2: [ENCRYPTED]      │
│ Bet 3: [ENCRYPTED]      │
│                         │
│ Until settlement:       │
│ NO ONE can read bets    │
│                         │
│ After settlement:       │
│ Only PNL is revealed    │
└─────────────────────────┘
```
Encrypted blocks have scrambled text animation (matrix-style).
**ZONE C**: Oracle architecture (3-tier, from Section 4 but with "PRIVATE" labels):
```
[Data Feed] → [Oracle (private compute)] → [Settlement (PNL only)]
                    ↓ NEVER REVEALED
              [Individual bets]
```
**Parasite labels**: "sealed until settlement", "BLS threshold", "only aggregate revealed".

### 181.2–194.0s: Speed + No Disputes
**ZONE D** (full-width): Dual timeline comparison:
```
TRADITIONAL:
[Order]──[Trade]──[Challenge period: 7 DAYS]──────────────────[Resolution]
                  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

GM:
[Bet]──[Settlement: 10 MIN]──[PNL]──[WITHDRAW]
       ████████████████████
```
Traditional timeline is LONG (stretches across screen). GM timeline is SHORT.
Red for traditional wait, green for GM speed. Dramatic length difference.
**Parasite labels**: "dispute window", "manual review", "voter incentives" (traditional). "Automatic", "oracle consensus", "instant" (GM).

---

## SECTION 6: FAQ 4 — MOAT (194.0s–247.4s) — Agent 7 + Agent 8

### Agent 7: Edge Concept (194.0s–216.8s)

### 194.0–204.9s: Market Overwhelm → Opportunity
**ZONE C**: Cascading market names scrolling rapidly (like a stock ticker but vertical):
```
xQc_viewers
pokimane_viewers
Berlin_delay
München_delay
DOGE_price
SHIB_price
CS2_players
...
```
Hundreds of names streaming. Overwhelming. Then they FREEZE → rearrange into organized grid → label: "Structure = opportunity."
**ZONE B**: Confused trader icon → transforms to strategic trader with radar.

### 204.9–212.1s: Single vs All Markets
**ZONE B+C** (wide): Strategy paradigm shift diagram:
```
TRADITIONAL:                    GENERAL MARKET:
                                
 [Magnifying glass]              [Radar sweep]
      │                              │
      ▼                              ▼
 ┌─────────┐                  ┌─────────────────┐
 │ 1 market │                  │ ALL 5000 markets│
 │ deep     │                  │ wide            │
 │ analysis │                  │ pattern         │
 └─────────┘                  └─────────────────┘
      │                              │
 Need: 60% edge                Need: 0.1% edge
 on 1 market                   on 5000 markets
      │                              │
 Total edge: 0.6               Total edge: 5.0
```
Numbers animate. The math visually proves "many small edges > one big edge."
**Parasite labels**: "concentrated risk", "diversified alpha", "law of large numbers".

### 212.1–216.8s: Scatter Plot
**ZONE B+C**: Animated scatter plot:
- X-axis: "Markets traded per day" (log scale: 1, 10, 100, 1K, 10K, 100K, 1M, 10M)
- Y-axis: "Edge per market" (0.01%, 0.1%, 1%, 10%, 100%)
- Traditional trader dot: (100, 10%) — few markets, high edge needed
- GM trader dot: (10M, 0.01%) — many markets, tiny edge works
- Shaded area under each shows TOTAL alpha (GM area is larger)
Plot draws itself: axes first, then grid, then dots with trails.

### Agent 8: Innovation Timeline + Competitive (216.8s–247.4s)

### 216.8–230.3s: Era Timeline with Charts
**ZONE D** (full-width): Horizontal timeline with embedded mini-charts at each era:

```
1920s                    1970s                     2026
  │                        │                        │
  ▼                        ▼                        ▼
┌──────────┐          ┌──────────┐           ┌──────────┐
│ ╱╲╱╲╱╲   │          │  f(S,K,  │           │ ████████ │
│ Candle   │          │  r,T,σ)  │           │ ████████ │
│ patterns │          │ B-Scholes│           │ Batch    │
│          │          │ formula  │           │ grid     │
└──────────┘          └──────────┘           └──────────┘
Few knew it           Few could compute       YOU are here
= massive edge        = massive edge          = massive edge
```
Each era card springs in when speaker mentions it. Mini-chart inside each card is animated (candles draw, formula types out, grid fills).
**Parasite labels**: "information asymmetry", "computational asymmetry", "instrument asymmetry".

### 230.3–241.5s: Competitive Landscape
**ZONE B+C** (wide): Bar chart showing competitive density:
```
STOCKS      ████████████████████████████ (saturated, red)
OPTIONS     ██████████████████████ (crowded, orange)
CRYPTO      ████████████████ (growing, yellow)
PRED MKTS   ██ (wide open, green, PULSING)
  GM        █ (first mover, bright green, GLOWING)
```
Bars animate left→right. GM bar pulses with green glow. Arrow pointing to it: "YOU ARE HERE."
**Parasite labels**: "$100T daily volume", "$10B daily", "$50M daily", "< $1M daily".

### 241.5–247.4s: Fortress vs Open Field
**ZONE B**: Traditional market as fortress (SVG castle with walls, moat, guards):
```
     ▓▓▓▓▓▓▓
    ▓ HEDGE ▓
    ▓ FUNDS ▓
    ▓▓▓▓▓▓▓▓
   /  MOAT   \
  /____________\
```
**ZONE C**: GM as open field with planted flag:
```
  
       ⚑
      / \
     /   \
    / YOUR \
   / TERRITORY\
  /____________\
```
Fortress is grey/imposing. Field is green/inviting. Flag waves with spring animation.

---

## SECTION 7: FAQ 5 + CLOSING (247.4s–282.9s) — Agent 9 + Agent 10

### Agent 9: Sources (247.4s–271.0s)

### 247.4–253.9s: Source Selection Tree
**ZONE B+C** (wide): Animated tree diagram:
```
                    [GENERAL MARKET]
                    /    |    |    \
                   /     |    |     \
            [TRAIN] [TWITCH] [STEAM] [PUMP.FUN] [...]
             / | \    / | \    / | \
            30  30  5K  5K   500 500  3M markets
         stations   streamers  games    tokens
```
Tree grows from root downward. Branches spring in. When speaker says each source name, that branch highlights green and leaves expand.
**ZONE D**: "YOU CHOOSE YOUR BRANCH" label with arrow pointing to one branch.
**Parasite labels**: "one batch per source", "trade only what you know", "specialization = edge".

### 253.9–264.9s: Source Detail Cards + Roadmap
**ZONE B+C**: 4 source cards (existing SourceCard style, keep them) BUT now with animated data flowing:
- Each card shows live-style data: "Last batch: 2m ago", "Next: in 8m", counter ticking.
**ZONE D**: Source roadmap timeline:
```
LAUNCHED: Train, Twitch, Steam, Pump.fun, Weather, ...
NEXT MONTH: Airlines, Sports, Elections, ...
YOUR REQUEST: [────────────────] → Submit
```
Roadmap scrolls left, showing platform growth.
**Parasite labels**: "47 sources live", "500K+ markets", "growing weekly".

### 264.9–271.0s: 1 Billion Target
**ZONE B+C** (wide): Exponential growth chart:
- Y-axis (log): 1K → 10K → 100K → 1M → 10M → 100M → 1B
- X-axis: months
- Curve swoops upward with animated trail
- Current position marked: "NOW: 500K"
- Target marked: "TARGET: 1,000,000,000"
Counter spins up alongside.
**Parasite labels**: "new sources weekly", "automatic scaling", "permissionless creation".

### Agent 10: Bot Ready + End Card (271.0s–282.9s)

### 271.0–276.9s: Bot Dashboard
**ZONE B+C** (wide): Full bot status dashboard (white, frontend style):
```
┌─────────────────────────────────────────────────────┐
│ ● LIVE  Twitch Viewer Prediction Strategy           │
├──────────┬──────────┬──────────┬────────────────────┤
│ TRADES   │ WIN RATE │ PNL      │ UPTIME             │
│ 47       │ 54.3%    │ +$12.40  │ 4m 31s             │
├──────────┴──────────┴──────────┴────────────────────┤
│ RECENT ACTIVITY                                      │
│ Batch #142: Bet on 5000 streamers → Settled → +$3.20│
│ Batch #141: Bet on 5000 streamers → Settled → -$1.80│
│ Batch #140: Bet on 5000 streamers → Settled → +$5.10│
└─────────────────────────────────────────────────────┘
```
Numbers animate. Live dot pulses. Activity rows scroll in.
Proves the 5-minute promise — bot IS running, trades ARE happening.

### 276.9–282.9s: Full Architecture Recap + End
**ZONE B+C** (full-screen dark overlay): The COMPLETE system in one diagram:
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [YOU] → [BOT] → [GM API] → [BATCH] → [ORACLE] → [PNL]│
│                     │                     │              │
│                  500K markets         3 nodes BLS        │
│                  47 sources           10 min settle      │
│                  $0 fees              No disputes        │
│                  Private              Instant withdraw   │
│                                                         │
│                    GENERAL MARKET                        │
│                  generalmarket.io                        │
│                                                         │
│  ✓ Liquidity   ✓ Capital Lock   ✓ Risk Management      │
└─────────────────────────────────────────────────────────┘
```
All elements from the video in one view. Each element springs in with stagger. Promise checkmarks animate last. Fade to black.

---

## Shared Components to Build

### `DiagramBox` — Reusable rounded rect with label, icon, and optional glow
### `AnimatedArrow` — SVG arrow with strokeDashoffset animation and optional particles
### `LeaderLine` — Thin line from diagram element to parasite text label
### `MiniChart` — Small inline chart (candle, bar, line, scatter) for embedding in diagrams
### `AnimatedGrid` — N×M grid of cells with stagger-fill and color transitions
### `FlowStep` — Single step in a process flow (box + arrow + label)
### `PoolDiagram` — YES/NO pool with fill bars and money-flow arrow

---

## Agent Summary

| Agent | Time Range | Primary Diagrams |
|-------|-----------|------------------|
| 1 | 0–42.8s | Bot pipeline, problem constellation, execution flow, profile cards |
| 2 | 42.8–57.8s | System architecture (5-tier), FAQ index |
| 3 | 57.8–89.8s | Batch anatomy, mandatory fill network, coverage heatmap, bell curve |
| 4 | 89.8–131.5s | Germany rail map, 10-min timeline, oracle architecture, price comparison |
| 5 | 131.5–161.4s | Parimutuel engine, 30x computation grid, PNL waterfall, risk cap |
| 6 | 161.4–194.0s | Order book anatomy, sealed architecture, dispute timeline |
| 7 | 194.0–216.8s | Market overwhelm, single-vs-all paradigm, scatter plot |
| 8 | 216.8–247.4s | Era timeline with mini-charts, competitive landscape, fortress vs field |
| 9 | 247.4–271.0s | Source tree, source roadmap, growth curve |
| 10 | 271.0–282.9s | Bot dashboard, full architecture recap, end card |

Each agent creates their file in `diagrams/` and adds it to TutorialVideo.tsx.
Each agent runs 3 rounds of autoresearch (build → verify coverage → polish animations).
