# MEGA PLAN — Zero Dead Seconds

Every second of this 4:43 video must have an active visual beyond the talking head. This plan maps every sentence to a specific schematic, graph, diagram, or animation.

## Principles

1. **No second without a visual** — if the speaker is talking, something is moving on screen
2. **Schematics > text** — prefer diagrams, flowcharts, architecture visuals over plain text
3. **Layer density** — at any moment, 2-3 simultaneous layers: subtitle + main visual + accent
4. **Frontend fidelity** — white panels, black stats bars, source cards, category pills
5. **Voice sync** — visuals ENTER when the speaker says the trigger word, not before

## Second-by-Second Visual Map

### ACT 1: HOOK (0.0s–42.8s)

| Time | Speech | Primary Visual | Type |
|------|--------|---------------|------|
| 0.0–0.2 | (silence) | **Black screen → logo reveal** | Transition |
| 0.2–3.4 | "How to launch your first GM bot in 5 minutes" | **Title card** (existing) + **architecture diagram**: tiny flowchart showing User → Claude → Bot → GM Platform. 4 boxes connected by arrows. | Schematic |
| 3.4–9.4 | "Not showing you a strategy... millionaire... two buttons" | **Anti-pattern visual**: mock "GET RICH" ad card with red X stamp over it. Satirical. Fades in, gets stamped, fades out. | Graphic |
| 9.4–11.3 | "No no no" | **Stay on face** — emphasis moment. Just subtitle. | — |
| 11.3–22.2 | "liquidity, capital lock, risk management" | **Problem matrix**: 3-column card, each column = one problem. Icon + label + one-line description. Columns highlight as speaker names each. Below: "These affect EVERY trader." | Schematic |
| 22.2–27.9 | "I will show you how to escape all that" | **Solution arrow**: Problem matrix shrinks, green arrow points right to "GENERAL MARKET BOT" box. Visual shows: problems → solution path. | Flow diagram |
| 27.9–34.1 | "Everyone encounters problems executing trades" | **Trade execution flow**: `Strategy → Order → Execution → Settlement → PNL`. Red X marks on "Execution" and "Settlement" (the pain points). | Process flow |
| 34.1–36.4 | "This video will be important for you" | **Audience spectrum bar**: horizontal bar from "Beginner" to "Fund Manager", both ends highlighted green. | Graphic |
| 36.4–41.8 | "Whether you are a beginner or already a hedge fund manager" | **Split profile cards**: Left card "RETAIL TRADER" with basic stats, Right card "FUND MANAGER" with fund stats. Both get green checkmarks. | Cards |
| 41.8–42.8 | "Let's start now" | **Transition flash** + timer starts | Transition |

### ACT 2: BOT TRIGGER (42.8s–57.8s)

| Time | Speech | Primary Visual | Type |
|------|--------|---------------|------|
| 42.8–48.6 | "Hey Claude, build me a bot..." | **Terminal** (existing) + **bot architecture diagram** appearing alongside: `Claude Code → Strategy Logic → GM API → Batch Markets`. Small diagram next to terminal. | Schematic |
| 48.6–57.8 | "Meanwhile, let's answer questions... liquidity on 500K markets" | **FAQ index card**: numbered list of 5 questions, #1 highlighted. Transition to liquidity section. Side: **market counter** spinning up to 500,000. | Card + Counter |

### ACT 3: FAQ 1 — LIQUIDITY (57.8s–89.8s)

| Time | Speech | Primary Visual | Type |
|------|--------|---------------|------|
| 57.8–59.2 | "Let's take an example" | **Batch anatomy diagram**: zoomed-in view of one batch structure: header (source name, tick duration) → list of submarkets → settlement rules. White card, frontend style. | Schematic |
| 59.2–62.4 | "5,000 Twitch streamers in a batch" | **Streamer grid** (existing enhanced) + **batch config card**: white panel showing "SOURCE: Twitch | ASSETS: 5,000 | TICK: 10 min | TYPE: Viewer Count". Frontend metrics row style. | Config card |
| 62.4–67.4 | "Every trader bets on every streamer... 10 minutes" | **Mandatory fill diagram**: circular flow showing Trader → ALL 5000 submarkets → YES/NO for each. Arrows radiate outward from center. Animated ring. | Network diagram |
| 67.4–72.1 | "System only accepts trades where you fill for every streamer" | **Order validation flow**: `Submit Order → Validate (5000 fills?) → Accept ✓ / Reject ✗`. Green path for accept. | Process flow |
| 72.1–76.7 | "No submarket is left out because everyone trades on everything" | **Coverage heatmap**: 50x100 grid, ALL cells green. Contrast: traditional market heatmap with 95% grey cells. Side by side. | Data viz |
| 76.7–84.8 | "It's harder to trade, but the benefit is huge" | **Tradeoff scale**: visual balance scale. Left: "Harder" (one weight). Right: "500K exclusive markets" (heavy stack). Scale tips right. | Diagram |
| 84.8–89.8 | "Some traders earn more because they are better" | **PNL distribution curve**: bell curve with left tail (losers, red) and right tail (winners, green). Label: "Skill determines position on curve." | Graph |

### ACT 4: FAQ 2 — SETTLEMENT (89.8s–161.4s)

| Time | Speech | Primary Visual | Type |
|------|--------|---------------|------|
| 89.8–94.8 | "How price works... let's take an example" | **FAQ index** briefly: #2 highlighted. Then: **Train delay intro card**: DB logo + "Deutsche Bahn Delay Batch" | Card |
| 94.8–100.4 | "Train delay batch. 30 train stations in a batch" | **Germany map schematic**: simplified rail network with 30 station dots. Each dot = one submarket. Dots light up with stagger. Station names: "Berlin Hbf", "München", "Hamburg"... | Map/Schematic |
| 100.4–107.8 | "30 times the question: will this station have more delay in 10 min?" | **Question card × 30**: animated stack of cards, each asking "Station X: More delay in 10 min? YES / NO". Cards flip through rapidly showing the scale. | Card stack |
| 107.8–113.8 | "While you bet yes or no, everyone pushes bets in a 10 minute window" | **Betting window timeline** (existing enhanced) + **order flow waterfall**: vertical stream of orders dropping into a pool. Each order: small colored block (green=YES, red=NO). Pool fills up. | Waterfall |
| 113.8–120.4 | "Then wait 10 minutes, Oracle computes who was right/wrong" | **Oracle consensus diagram**: 3-node triangle + BLS signature aggregation visual. Arrows: Data feeds → Oracle nodes → Consensus → Smart contract. Detailed architecture. | Architecture |
| 119.9–126.1 | "Each Oracle compute PNL following parimutuel computation" | **Parimutuel computation flow**: `Collect bets → Group by submarket → For each: winners take losers → Sum across 30 → Final PNL`. Vertical process flow with numbers at each step. | Process flow |
| 126.2–131.5 | "No price, quotation revealed at the end" | **Price comparison chart**: Traditional market = continuous price line (candle chart). GM = flat line then single settlement point. Visual shows absence of price discovery. | Chart |
| 131.5–135.7 | "What is parimutuel? Fancy word for something simple" | **Parimutuel pool diagram** (existing enhanced) + **horse racing analogy visual**: simple horse race icon → "Same math, digital markets". Tying the concept to something familiar. | Diagram |
| 135.7–142.4 | "If traders who bet YES win, they win collateral of NO bettors" | **Collateral flow animation**: Two pools with $ amounts. Arrow from NO pool to YES pool. Numbers animate. Clear visual of money movement. | Flow diagram |
| 142.4–147.4 | "We do this computation 30 times for each train station" | **Computation grid**: 5×6 grid of mini pool diagrams, each running its own YES/NO resolution simultaneously. Shows parallelism. | Grid viz |
| 147.4–150.4 | "Sum getting your final PNL" | **PNL waterfall chart**: 30 bars (some green +, some red −), waterfall style accumulating to final total. Classic financial visualization. | Chart |
| 150.4–159.7 | "Correction: $1 vs $1M, max loss capped" | **Risk cap diagram** (existing enhanced) + **proportional matching visual**: two traders connected by line, numbers showing matched amounts. Small trader fully matched, large trader partially matched. | Diagram |
| 159.7–161.4 | "I like this one a lot" | **Summary card**: "Settlement: ✓ 10 min | ✓ No price | ✓ $0 fees | ✓ Risk capped | ✓ Instant withdrawal". All green checkmarks. | Summary card |

### ACT 5: FAQ 3 — PRIVACY (161.4s–194.0s)

| Time | Speech | Primary Visual | Type |
|------|--------|---------------|------|
| 161.4–166.2 | "How GM be private when others aren't?" | **FAQ index** briefly: #3 highlighted. **Privacy architecture overview**: high-level diagram of GM system with "SEALED" labels on bet data flows. | Architecture |
| 166.2–170.4 | "Other markets run on order books" | **Order book anatomy**: traditional LOB with bid/ask levels, trade tape showing everyone's orders. Red labels: "VISIBLE", "COPYABLE", "FRONT-RUNNABLE". | Schematic |
| 170.4–172.8 | "Running on public oracles" | **Public oracle flow**: Oracle → Public blockchain → Anyone can read → Copy trader follows. Red flow arrows showing data leakage. | Flow diagram |
| 172.8–181.2 | "Built a specialized scalable oracle" | **GM oracle architecture**: Detailed 3-tier diagram. Tier 1: Data feeds (APIs). Tier 2: 3 Oracle nodes (BLS signing). Tier 3: L3 settlement. Arrows between tiers. Labels: "Private", "Consensus", "Instant". | Architecture |
| 181.2–194.0 | "Every market settles instantly, no disputes" | **Dispute comparison timeline**: Traditional: Order → Trade → Challenge period (7 days) → Resolution. GM: Bet → Settlement (10 min) → PNL. Two timelines side by side, GM dramatically shorter. | Timeline |

### ACT 6: FAQ 4 — MOAT (194.0s–247.4s)

| Time | Speech | Primary Visual | Type |
|------|--------|---------------|------|
| 194.0–202.6 | "Most interesting question. So many markets I don't know" | **FAQ index**: #4 highlighted. **Market overwhelm visual**: cascading list of market names scrolling fast, user icon looking overwhelmed. Then: "But that's the point." | Graphic |
| 202.6–212.1 | "How do I find a moat? Not one market, but ALL markets" | **Single vs multi strategy diagram**: Left: magnifying glass on 1 market (traditional). Right: radar scanning ALL markets (GM). The paradigm shift visualized. | Diagram |
| 212.1–216.8 | "Quantity over quality" | **Scatter plot**: X-axis "markets traded", Y-axis "edge per market". Traditional trader: few markets, needs high edge. GM trader: many markets, small edge per market, but total is larger. Area under curve comparison. | Graph |
| 216.8–230.3 | "1920s... 1970s... 2026" | **Innovation timeline** (existing enhanced) + **paradigm detail cards** with mini-charts: 1920s candlestick pattern, 1970s options payoff curve, 2026 batch settlement grid. Each era gets its own iconic visualization. | Timeline + Charts |
| 230.3–241.5 | "Easier starting from new instrument" | **Competitive landscape chart**: bar chart. Stocks: saturated (red). Options: saturated. Crypto: crowded. Prediction markets: wide open (green). Visual competitive analysis. | Bar chart |
| 241.5–247.4 | "Every order book instrument, hedge funds with huge moat" | **Moat fortress visual**: traditional markets as a castle with walls. GM as an open field with flag planted. "First mover advantage available." | Graphic |

### ACT 7: FAQ 5 — SOURCES + CLOSING (247.4s–282.9s)

| Time | Speech | Primary Visual | Type |
|------|--------|---------------|------|
| 247.4–253.9 | "Do I need to bet on every market? One batch per source" | **FAQ index**: #5 highlighted. **Source selection tree**: tree diagram. Root = "General Market". Branches = Sources (Train, Twitch, Steam...). Leaves = individual markets. User picks a BRANCH, not every leaf. | Tree diagram |
| 253.9–260.0 | "Only trade on train, twitch, steam" | **Source cards** (existing enhanced) + **source comparison table**: white panel, rows for each source with columns: Name, Markets, Tick, Category. Frontend table style. | Table |
| 260.2–264.9 | "If there is demand, you can ask and we will add it" | **Source roadmap**: timeline showing past sources (launched) → current → "YOUR REQUEST HERE" with dashed box. Shows the platform is growing. | Roadmap |
| 264.9–271.0 | "Vision: 1 billion parallel markets" | **Exponential growth chart**: logarithmic Y-axis. Points: "Today: 500K" → "Next month: 1M" → "Target: 1B". Curve swooping up. Background: subtle particle field expanding. | Chart |
| 271.0–276.9 | "Strategy seems ready, Claude launched it" | **Bot status dashboard**: white panel showing bot metrics. Strategy: "Twitch Viewer Prediction". Status: "RUNNING ✓". Trades: counter spinning up. PNL: +$0.00 (just started). Live dot. | Dashboard |
| 276.9–280.8 | "Clearer how GM works" | **Full architecture recap**: single diagram showing everything — User → Bot → Batch → Settlement → Oracle → PNL. All the pieces connected. The system in one view. | Architecture |
| 280.8–282.9 | "Max, General Market Founder" | **End card** with logo + URL + all promises checked | End card |

---

## New Components to Build (10 Agents)

### AGENT 1: `diagrams/ArchitectureFlow.tsx` — System architecture diagrams
**3 diagrams appearing at different times:**
- (0.2s) Mini bot pipeline: User → Claude → Bot → GM
- (172.8s) Oracle 3-tier architecture  
- (276.9s) Full system recap diagram

All drawn with SVG: rounded rect boxes, connecting arrows, labels. Animated: boxes spring in, arrows draw themselves (strokeDashoffset). Dark bg variant for over video, white bg variant for panels.

### AGENT 2: `diagrams/ProcessFlows.tsx` — Step-by-step process flows
**4 process flows:**
- (27.9s) Trade execution: Strategy → Order → Execution → Settlement → PNL (with red X on pain points)
- (67.4s) Order validation: Submit → Validate fills → Accept/Reject
- (119.9s) Parimutuel computation: Collect → Group → Resolve → Sum → PNL
- (181.2s) Dispute comparison: Traditional (7 days) vs GM (10 min)

Vertical or horizontal step flows. Each step is a rounded rect, connected by arrows. Active step highlighted. Green path for GM, red for problems.

### AGENT 3: `diagrams/DataViz.tsx` — Charts and graphs  
**5 data visualizations:**
- (84.8s) PNL distribution bell curve (winners green, losers red)
- (147.4s) PNL waterfall chart (30 bars accumulating)
- (212.1s) Scatter plot: markets traded vs edge per market
- (230.3s) Competitive landscape bar chart (stocks, options, crypto, PM)
- (264.9s) Exponential growth curve to 1 billion

SVG charts with animated paths. Numbers animate. Axes labeled.

### AGENT 4: `diagrams/NetworkDiagrams.tsx` — Node/connection visuals
**3 network diagrams:**
- (62.4s) Mandatory fill ring: trader in center, 5000 markets radiating out
- (113.8s) Oracle consensus: 3 nodes + BLS + data feeds + smart contract
- (166.2s) Data leakage flow: public oracle → anyone reads → copy trader

SVG circles as nodes, animated connecting lines with arrowheads. Pulsing. Labels.

### AGENT 5: `diagrams/ComparisonCards.tsx` — Side-by-side comparisons
**4 comparison panels:**
- (3.4s) Anti-pattern: "GET RICH" card with red X stamp
- (72.1s) Coverage heatmap: all-green vs mostly-grey grids
- (126.2s) Price chart: continuous candles vs single settlement point
- (241.5s) Moat fortress vs open field

Split-screen panels with clear visual contrast. Red/grey for traditional, green for GM.

### AGENT 6: `diagrams/ConfigCards.tsx` — Frontend-style config/status cards
**5 white cards matching frontend design:**
- (57.8s) Batch anatomy: header + submarket list + settlement rules
- (59.2s) Batch config: Source, Assets, Tick, Type metrics row
- (94.8s) Train delay intro: DB logo + batch name
- (159.7s) Settlement summary: all features checkmarked
- (271.0s) Bot status dashboard: strategy name, status, trades, PNL

White bg, border patterns, micro labels, metrics rows — exact frontend style.

### AGENT 7: `diagrams/MapSchematic.tsx` — Germany rail map
**(94.8s–107.8s)** Simplified Germany rail network:
- Country outline (SVG path)
- 30 station dots positioned approximately correctly
- Station labels for major ones (Berlin, München, Hamburg, Frankfurt, Köln)
- Lines connecting stations (rail routes)
- Dots light up with stagger as speaker mentions "30 stations"
- Each dot pulses when its submarket is mentioned

Clean, minimalist map. Dark bg. White lines, green dots.

### AGENT 8: `diagrams/QuestionStack.tsx` — Card stack + FAQ index
**FAQ index** (appears 5 times, highlighting active question):
1. How does GM ensure liquidity? (48.6s)
2. How does pricing work? (89.8s)
3. How is GM private? (161.4s)
4. How do I find an edge? (194.0s)
5. Do I need every market? (247.4s)

**Question card stack** (100.4s): 30 cards animating through rapidly, each asking "Station X: More delay?" Simulates the scale of 30 simultaneous questions.

Small, top-right position. Number badge on active question. Previous questions get checkmarks.

### AGENT 9: `diagrams/CollateralFlow.tsx` — Pool animations and money movement
**3 collateral/money animations:**
- (135.7s) Two pools: YES ($500) → NO ($500). Arrow shows money flow from losers to winners. Numbers animate.
- (142.4s) Computation grid: 6×5 mini pools running simultaneously
- (151.9s) Proportional matching: $1 trader ↔ $1M trader, matched amount shown

Animated SVG with flowing particles along arrows to show money movement.

### AGENT 10: `diagrams/GrowthRoadmap.tsx` — Roadmap, tree, and growth visuals
**3 visuals:**
- (247.4s) Source selection tree: root → branches → leaves
- (260.2s) Source roadmap: past → current → "YOUR REQUEST HERE"  
- (76.7s) Tradeoff scale: balance scale tipping right

Interactive-feeling animated diagrams. Tree branches grow outward. Roadmap scrolls.

---

## Integration

After all agents complete, update `TutorialVideo.tsx` to add 10 new diagram layers. Each diagram component is a full-duration overlay that manages its own visibility (appears/disappears at the right moments).

## Autoresearch

3 rounds on each agent:
1. Build + tsc
2. Verify timing matches this plan exactly. Verify no 5-second gap without a visual.
3. Polish SVG quality, animation smoothness, label readability. Run tsc.
