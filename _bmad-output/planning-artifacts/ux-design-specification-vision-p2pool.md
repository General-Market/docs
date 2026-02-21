---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - docs/plans/vision-p2pool-brief.md
  - docs/plans/2026-02-20-merge-solidity-vision.md
  - _bmad-output/planning-artifacts/ux-vision-direction.html
  - frontend/components/domain/vision/VisionPage.tsx
  - frontend/components/domain/vision/VisionMarketsGrid.tsx
  - frontend/components/domain/vision/LeaderboardTable.tsx
  - frontend/components/domain/vision/AnimatedLeaderboardRow.tsx
  - frontend/hooks/vision/useMarketSnapshot.ts
  - frontend/hooks/vision/useLeaderboard.ts
---

# UX Design Specification — Vision P2Pool

**Author:** max
**Date:** 2026-02-21
**Approach:** New product built on existing Vision visual language (BlackRock institutional style)

---

## Executive Summary

### Project Vision

Vision P2Pool is a perpetual prediction market where players join rolling batches, place bitmap bets across thousands of markets (crypto, stocks, weather, predictions, etc.), and compete in a zero-sum pool. It replaces the current bilateral bet model (1v1 agents + keepers) with a scalable pooled model. Batches run forever — anyone joins anytime and plays until their USDC deposit runs out. Issuers resolve each 10-minute tick via BLS consensus, tracking only two things: resolution of each market and balance of each player.

### Target Users

Two distinct user types with fundamentally different interaction models:

1. **Bots / AI agents** — Submit bitmaps directly via API, skip UI entirely. Power users who need data endpoints, not visual interfaces. The UI is invisible to them.
2. **Human players** — Need visual interaction for small batches (click up/down cards), or fork strategy templates for large batches (Python editor). These users want to compete with bots using intuition, strategy templates, and data browsing.

### Key Design Challenges

1. **Complexity cliff** — The bitmap/multiplier/tick system is conceptually dense. Casual users need a "just click up/down" experience while power users need full scripting control. Auto-switching by batch size (<=20 visual, 21-100 compact, 100+ script) is the core adaptive pattern.

2. **Dual-audience tension** — Bots skip the UI entirely. The UI primarily serves humans who want to compete with bots. The UI must provide enough data advantage (live prices, backtest stats, strategy templates) that humans don't feel helpless.

3. **Balance burn rate visibility** — The multiplier system means users with high commitment burn faster. Users need real-time understanding of "how many ticks do I have left" and "is my multiplier helping or hurting me."

4. **Information density at scale** — Batches can contain 10,000+ markets. The existing heatmap tile pattern works for browsing, but betting on 10k markets requires scripting, not clicking.

5. **Temporal UX** — 10-minute ticks create constant time pressure. Countdown, current tick state, and upcoming bets must be clearly visible.

### Design Opportunities

1. **Batch card as hero unit** — Cards with animated headers (sparklines for small batches, heatmaps for large). Each card is a living, breathing market view.

2. **Strategy templates as social proof** — "Momentum: 54% win, 3k uses" lowers the barrier and creates a community meta-game around strategy effectiveness.

3. **Inline expansion** — Click a card, it expands in-place. No page navigation. Keeps the "browsing a grid" mental model while adding depth.

4. **Existing heatmap infrastructure** — VisionMarketsGrid already has 150k+ virtual-scrolled tiles with category tabs. This becomes the market browser for custom batch creation.

## Core User Experience

### Defining Experience

The core loop is: **Browse → Expand → Bet → Watch → Collect**. Users land on a grid of batch cards (each a living market view), click to expand inline, place predictions via visual toggle or Python script, submit their bitmap hash on-chain, and watch 10-minute ticks resolve in real-time.

The critical interaction to perfect is the **batch card expansion**. This is where browsing becomes participation. The transition from "looking at a card" to "I'm betting on markets" must feel seamless and immediate — no page loads, no modal stacking, no wallet prompts until the user hits Submit.

### Platform Strategy

| Dimension | Decision |
|-----------|----------|
| Platform | Web application (Next.js, existing frontend stack) |
| Primary input | Desktop mouse/keyboard — data-dense layouts, tables, code editors |
| Responsive | Tablet-friendly for visual mode; mobile for monitoring balance/results only |
| Bot access | REST API to data-node + direct on-chain tx — UI is irrelevant to bots |
| Offline | None — product is real-time ticks, live prices, countdown timers |
| Key constraint | Existing Vision visual language (BlackRock institutional) must be preserved |

### Effortless Interactions

1. **Bitmap abstraction** — Users never see or think about bitmaps. Visual mode: click up/down arrows per market. Script mode: write Python that returns a list of 0/1. The system handles encoding, hashing, and on-chain submission.

2. **Template one-click** — Strategy templates ship with backtest stats and usage counts. User clicks a template, sees preview result ("5,412 up / 4,588 down"), clicks Submit. Under 10 seconds from browse to committed.

3. **Auto burn-rate display** — Balance, stake per tick, multiplier, and "estimated ticks remaining" shown at all times. No mental math required. Color-coded warnings when balance is running low.

4. **Batch size auto-adaptation** — <=20 markets: visual card grid with sparklines. 21-100: compact toggleable rows. 100+: script editor as default. User never has to choose — the UI adapts.

5. **Tick resolution feed** — After each tick resolves, results appear inline: per-market outcomes, your bets vs. reality, net P&L for the tick. No navigation needed.

### Critical Success Moments

| Moment | What happens | Why it matters |
|--------|-------------|----------------|
| First batch joined | Card expands, bets placed, bitmap submitted in <30s | "This is actually easy" realization |
| First tick resolves | Check/cross results appear, balance updates | Instant feedback loop established |
| First profitable tick | Green P&L notification, balance increases | Dopamine hit, retention trigger |
| Backtest validation | Template shows 54% win rate over 100 ticks | Confidence to commit real USDC |
| Multiplier payoff | High-commitment user wins disproportionate share | "The system rewards skill and conviction" |
| Balance depletion warning | "~12 ticks remaining" alert | User tops up or adjusts stake — prevents surprise exit |

### Experience Principles

1. **Data density over decoration** — Every pixel earns its place. Heatmaps, sparklines, and compact rows convey more than animations or illustrations. The BlackRock aesthetic: information is the interface.

2. **Progressive complexity** — Visual mode for beginners (click arrows), compact rows for intermediates (scan and toggle), script mode for power users (full Python). Never force complexity on casual users.

3. **Real-time everything** — Tick countdowns, live price updates, balance changes, resolution feeds. The product is temporal — the UI must feel alive and urgent without being stressful.

4. **Zero bitmap awareness** — The bitmap is the protocol's innovation, not the user's problem. Encoding order, hash commitment, issuer submission — all invisible. Users express intent ("BTC goes up"), the system handles the rest.

5. **Compete with data, not UI chrome** — Since bots are the ultimate competitors, human players need data advantage tools: backtests, strategy templates, market snapshots, win/loss history patterns. The UI is a competitive weapon.

## Desired Emotional Response

### Primary Emotional Goals

**"The entire world is my trading floor."** Users should feel the thrill of scale — 50,000+ markets spanning volcanoes, rainfall, Bitcoin, congressional elections, npm download counts. The emotional core is wonder at the breadth, then confidence that they can participate in any of it.

**Secondary: "I'm getting smarter."** The UI is a funnel toward autonomy. Each interaction teaches the user something that makes them more capable. Visual mode teaches market intuition. Compact rows teach pattern scanning. Script mode teaches algorithmic thinking. The emotional arc is: curiosity → competence → automation.

### Emotional Journey Mapping

| Stage | Emotion | Design Response |
|-------|---------|-----------------|
| **Discovery** (landing page) | Wonder + "wait, I can bet on THAT?" | Visual diversity — batch cards show volcano imagery, rain maps, candlestick patterns, Twitch streams. The grid itself tells the story. |
| **First expansion** | Curiosity + "this is simpler than I expected" | Visual mode: clear up/down arrows, live sparklines, familiar price cards. No jargon. |
| **First bet placed** | Excitement + mild nervousness | Countdown timer creates anticipation. "Your bets are locked in. Next tick in 7:42." |
| **First tick resolves** | Satisfaction (win) or determination (loss) | Immediate check/cross pattern. Green/red balance change. "You got 7/10 right." Zero-sum means someone else lost — competitive edge. |
| **Strategy template discovered** | "I can automate this?" moment | Templates with backtest stats. One-click fork. This is the funnel-to-bot inflection point. |
| **First script written** | Empowerment — "I'm a quant now" | Python editor with live preview, instant backtest. The graduation moment. |
| **Running a bot** | Detached confidence — checking P&L like a dashboard | Balance history, tick-by-tick results, multiplier efficiency. The UI becomes monitoring, not interaction. |

### Micro-Emotions

**Cultivate:**
- **Awe** at market diversity — volcano eruptions, solar flares, npm trends all tradeable
- **Competitive hunger** — leaderboard, win streaks, multiplier advantage
- **Growing competence** — each step from visual → compact → script feels earned
- **Trust in resolution** — BLS-signed, on-chain verified, no disputes

**Avoid:**
- **Overwhelm** — 50k markets is exciting, not paralyzing (batch curation solves this)
- **Helplessness vs bots** — strategy templates and backtests level the field
- **Confusion about multipliers** — always show burn rate and remaining ticks
- **Fear of bitmap errors** — system handles encoding, user just clicks or scripts

### Design Implications

| Emotion Target | UX Decision |
|---------------|-------------|
| Wonder at diversity | Batch card headers show category-specific imagery: volcano photos, rain animations, candlestick minigrids, Twitch viewer counts. Not abstract icons — real visual context. |
| "I can bet on that?" | Market categories are visually distinct and browsable. Weather has actual temp maps. Predictions show odds bars. Tech shows download sparklines. |
| Funnel to bots | Script tab always visible (even if not default). "Automate this strategy" CTA after 5+ manual ticks. Template library prominently featured. |
| Competitive edge | Leaderboard of top players per batch. Win streak badges. Multiplier rank. "Your strategy outperforms 72% of players." |
| Trust in fairness | BLS signature count visible. "Resolved by 14/20 issuers." On-chain verification link. |

### Emotional Design Principles

1. **Show the world, not the protocol** — Volcano imagery > bitmap hex. The product trades reality, so the UI should feel like a window into the real world, not a blockchain dashboard.

2. **Celebrate breadth** — Every category deserves its own visual language. Crypto gets candlesticks. Weather gets atmospheric imagery. Predictions get probability bars. The grid should feel like a mosaic of the entire world.

3. **Graduation, not gatekeeping** — Visual mode is where everyone starts. Script mode is where everyone ends up. The transition should feel like leveling up, not like hitting a wall.

4. **Urgency without anxiety** — Tick countdowns create energy but shouldn't stress. Use calm typography (Inter), steady countdown animations, and green/red only for results — not for time pressure.

5. **Zero-sum honesty** — Don't hide that this is competitive. Show the pool size, show how many players, show what the winners took. Transparency builds trust in a zero-sum game.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**1. Finviz Heatmap / TradingView Heatmap**
- Visualizes entire market sectors as colored tiles — size by market cap, color by performance. Thousands of assets at a glance.
- The batch card headers and VisionMarketsGrid already follow this pattern. The P2Pool grid of batch cards IS a heatmap of heatmaps.
- Steal: Tile density, color intensity mapping, hover-to-reveal detail. The "lean back and scan" experience.

**2. Polymarket**
- Clean prediction market browsing. Category tabs, odds bars, simple yes/no positions.
- Closest competitor model. Users browse markets, pick outcomes, commit capital.
- Steal: Category filtering UX. Clean odds display. "Trending" and "New" sort modes.
- Avoid: Individual market pages break flow. P2Pool's inline expansion is better.

**3. QuantConnect / Quantopian**
- Python strategy editors with live backtesting. Write code → backtest → deploy with real capital.
- This IS the Script tab. The "funnel to bots" endgame.
- Steal: Template gallery with performance stats. Inline backtest visualization. "Clone and edit" workflow.

**4. Bloomberg Terminal**
- Maximum information density. Every pixel is data. Monospace everything.
- The BlackRock/institutional visual language already borrows from this. The "trade everything" ethos — Bloomberg covers every asset class.
- Steal: Density philosophy. Black section headers. Tabular numbers. Data IS the interface.

**5. Winamp / retro media visualization**
- Visualizations that respond to data — waveforms, frequency bars, oscilloscopes.
- Batch card animated headers serve the same role — they make data feel alive. Each card is a "visualizer" for its markets.
- Steal: Visualization IS identity. Not a chart you read — a visual you feel.

### Transferable UX Patterns

**Navigation Patterns:**
- **Grid-to-detail inline expansion** — Click a card, it expands in place. Never navigate away.
- **Category pill filtering** — Horizontal scrollable pills. Already in VisionMarketsGrid.
- **Tab switching within context** — VISUAL / SCRIPT tabs within an expanded card.

**Interaction Patterns:**
- **One-click template fork** — See a strategy, click "Use This", it's loaded with your batch's markets.
- **Toggle arrays** — For compact rows (21-100 markets), each row is a single toggle. Scan fast, decide fast.
- **Backtest-before-commit** — Never submit a strategy blind. Always see historical win rate first.

**Visual Patterns:**
- **Heatmap-as-identity** — Color intensity = conviction. The tile grid IS the product's visual signature.
- **Mixed-category batch headers** — Batches span multiple categories (crypto + weather + predictions in one batch). Headers show a mosaic of category visuals — not one image but a composite strip reflecting the batch's market diversity. A "General 10k" batch header is a miniature world map of data categories.
- **Countdown as ambient element** — Tick countdown is steady and ambient, not panic-inducing.

### Anti-Patterns to Avoid

| Anti-Pattern | Why it's bad | Our alternative |
|-------------|-------------|-----------------|
| **Page-per-market** | Breaks flow, forces navigation, loses grid context | Inline expansion — card opens in place |
| **Wallet-first UX** | "Connect wallet" before seeing anything = bounce | Browse freely. Wallet only at Submit. |
| **Toy code editors** | Feels unserious for real-money strategies | Monaco editor with real Python syntax, autocomplete, errors |
| **Hidden complexity** | Oversimplifying creates distrust in sophisticated users | Progressive disclosure — simple surface, full data one click deeper |
| **Gamification overload** | Confetti, XP bars feel cheap | Win streaks as data patterns (check/cross), not celebrations |
| **Jargon walls** | "BLS aggregated signature", "bitmap hash" in UI | Human language: "Verified by 14 keepers", "Your predictions" |
| **Single-category assumption** | Batch = one category is wrong. Batches are cross-category. | Cards must visually represent mixed content — composite headers, multi-category tags |

### Design Inspiration Strategy

**Adopt directly:**
- Finviz heatmap tile grid as batch card identity and market browser
- QuantConnect template gallery with backtest stats
- Polymarket category pill filtering for market browsing
- Bloomberg data density philosophy for all tables and stats

**Adapt for our context:**
- Polymarket's per-market browsing → batch-level browsing (batches are curated collections spanning multiple categories)
- QuantConnect's full IDE → lightweight Monaco editor with templates
- Bloomberg's monochrome → BlackRock palette + category-specific imagery in batch card headers (composite strips for multi-category batches)

**Avoid entirely:**
- Per-market page navigation — everything is inline
- Wallet-first onboarding — browse freely, wallet at submit
- Gamification chrome — data patterns are the reward
- Blockchain jargon anywhere in the UI
- Assuming batches map 1:1 to categories

## Design System Foundation

### Design System Choice

**Custom Tailwind-based system** — Already in production in frontend. Not adopting a third-party component library. The BlackRock institutional aesthetic requires pixel-level control that MUI/Chakra/shadcn can't deliver without fighting their defaults.

### Rationale for Selection

| Factor | Decision |
|--------|----------|
| Existing investment | frontend already has 30+ custom components in the institutional style |
| Brand uniqueness | BlackRock/iShares-level polish requires full control, not themed components |
| Performance | Tailwind purges unused CSS. No runtime style overhead from component libraries. |
| Team expertise | Solo developer (max) — knows the system intimately, no onboarding cost |
| Data density needs | Bloomberg-level density requires custom layout primitives, not opinionated grids |

### Implementation Approach

**Extend, don't rebuild.** The P2Pool product adds new components to the existing system:

**Existing components (reuse as-is):**
- `Card`, `Button`, `Table`, `FilterPill` — foundation primitives
- `SectionBar` — black section headers with live indicators
- `StatsRow` — horizontal stat cells with labels
- `HeroBand` — page hero with eyebrow/title/subtitle
- `TransactionStepper` — multi-step on-chain flow UI
- Heatmap tile grid pattern from `VisionMarketsGrid`

**New components needed for P2Pool:**
- `BatchCard` — Grid card with animated header, batch stats, player count, TVL
- `BatchExpanded` — Inline expansion with VISUAL/SCRIPT tabs
- `MarketToggle` — Up/down toggle for individual market predictions (visual mode)
- `CompactMarketRow` — Toggleable row for 21-100 market batches
- `TickCountdown` — Ambient countdown timer for next tick resolution
- `TickResultFeed` — Per-tick resolution results with check/cross patterns
- `StrategyEditor` — Monaco-based Python editor with template loading
- `BacktestChart` — Equity curve / win-rate visualization for strategy previews
- `BurnRateIndicator` — Balance + multiplier + estimated ticks remaining
- `BitmapPreview` — Visual representation of upcoming bets (the check/cross future strip)
- `BatchCreator` — Market selection from the existing heatmap grid → batch definition flow

### Customization Strategy

**Design tokens (CSS variables, already defined):**

```css
:root {
  --page: #FFFFFF;
  --surface: #F5F5F5;
  --black: #000000;
  --text-primary: #1A1A1A;
  --text-secondary: #555555;
  --text-muted: #999999;
  --border: #E0E0E0;
  --up: #16A34A;
  --down: #DC2626;
  --mono: 'JetBrains Mono', monospace;
  --sans: 'Inter', -apple-system, sans-serif;
}
```

**New tokens for P2Pool:**

```css
:root {
  /* Tick state colors */
  --tick-active: #3B82F6;      /* blue — current tick in progress */
  --tick-resolved: #6B7280;    /* gray — past resolved tick */
  --tick-upcoming: #F59E0B;    /* amber — your future committed ticks */

  /* Multiplier visualization */
  --mult-low: #94A3B8;         /* 1.0-1.5x */
  --mult-mid: #3B82F6;         /* 1.5-2.5x */
  --mult-high: #8B5CF6;        /* 2.5x+ */

  /* Category accent colors for mixed-batch headers */
  --cat-crypto: #F59E0B;
  --cat-stocks: #3B82F6;
  --cat-weather: #06B6D4;
  --cat-predictions: #8B5CF6;
  --cat-tech: #10B981;
  --cat-macro: #6B7280;
  --cat-commodities: #D97706;
  --cat-entertainment: #EC4899;
  --cat-transport: #64748B;
}
```

**Typography scale (unchanged from existing):**
- Headings: Inter 900, -0.03em tracking
- Body: Inter 400-600
- Data: JetBrains Mono, tabular-nums
- Labels: 10-11px uppercase, 0.08-0.12em tracking
- All numbers right-aligned in tables and stats

## Detailed User Experience

### Defining Experience

**"Bet on the world, every 10 minutes."**

The defining experience is: You see a grid of living batch cards — each one a curated slice of reality (crypto top 10, weather stations, everything). You click one. It opens. You predict what goes up and down. You submit. Every 10 minutes, the world tells you if you were right.

That's the sentence users will say to friends: "I'm betting on volcanoes, Bitcoin, and the weather — all in the same pool — and it resolves every 10 minutes."

### User Mental Model

**What users bring:**
- Sports betting — "pick outcomes, stake money, wait for results"
- Fantasy sports — "build a portfolio/strategy, compete against others over time"
- Trading — "read data, make predictions, risk/reward tradeoff"

**Where the mental model breaks:**
- **No odds** — Everyone bets the same bitmap (1/0 per market). Payout depends on how many others got it wrong, not on preset odds.
- **No individual markets** — You join a batch and bet on ALL its markets simultaneously. The batch is the unit, not the market.
- **Rolling, not event-based** — Ticks resolve every 10 minutes, perpetually. Closer to a heartbeat than an event.
- **Multipliers are weird** — More commitment = more weight = faster burn. Must be shown, not explained.

**How we bridge the gap:**
- Visual mode makes it look like sports betting (up/down toggles per market)
- The batch card makes it look like a fantasy sports "roster"
- The tick countdown makes it feel like a game clock
- Multiplier effects shown as "your bet weight: 2.4x" with burn rate, not as a formula

### Success Criteria

| Criteria | Measurement | Target |
|----------|-------------|--------|
| First bet speed | Time from landing page to submitted bitmap | < 60 seconds |
| Comprehension | User can explain what they bet on after first tick | No jargon needed |
| Return trigger | User checks back within 10 minutes (next tick) | > 70% of first-time users |
| Script graduation | Users who start visual and eventually try script mode | > 30% within 10 sessions |
| Balance awareness | User can state their remaining ticks at any time | Always visible |
| Zero confusion on results | User understands why they won/lost each sub-market | Check/cross + price movement inline |

### Novel UX Patterns

**Novel — Bitmap as invisible substrate:**
The entire betting system runs on bitmaps (1 bit per market per tick), but users never see or interact with bitmaps directly:
- Visual mode: toggle up/down per market → system generates bitmap
- Script mode: write Python returning [0,1,1,0...] → system encodes bitmap
- On-chain: system hashes and submits → user signs one tx

**Novel — Mixed-category batch cards:**
Batches can contain crypto + weather + politics + npm downloads. Card header = **composite mosaic** — horizontal strip where each segment is colored by category, proportional to market count:

```
[▓▓▓▓▓ crypto 38%][▒▒▒ stocks 18%][░░ weather 15%][▓▓ predictions 12%][░ tech 9%][▒ other 8%]
```

**Design correction — Two tiers, not three:**
The original brief proposed 3 UI tiers (<=20 visual cards, 21-100 compact rows, 100+ script). **Revised to 2 tiers:**

| Batch size | Default mode | UI |
|------------|-------------|-----|
| 0-100 markets | **Visual** | Scrollable toggleable rows — same layout whether 5 or 100 markets. Each row: toggle ▲/▼ + symbol + price + change + mini sparkline + history strip |
| 100+ markets | **Script** | Monaco Python editor with templates + backtest |

Both modes always available via VISUAL / SCRIPT tabs. The visual mode scales gracefully from 1 to 100 rows without layout changes.

### Experience Mechanics

**1. Initiation — Landing on the grid:**

```
User arrives → sees grid of batch cards
Each card:
  - Composite mosaic header (category-proportional color strips)
  - Batch name ("Crypto Top 10", "Everything 10k", "Meme 5")
  - Market count + resolution type + tick duration
  - Player count + TVL

Grid ends with [ + CREATE BATCH ]
```

**2. Interaction — Expanding and betting:**

```
User clicks card → card expands inline

0-100 markets (Visual mode default):
  Scrollable rows, each row:
    [▲/▼ toggle] | Symbol | Price | 24h change | Mini sparkline | History strip (✓✗✓✓✗)

  Bulk actions: [ALL ▲] [ALL ▼] [FLIP ALL]

  For very small batches (≤5): rows are wider with larger sparklines
  For medium batches (6-100): compact rows, same layout, just more scrolling

100+ markets (Script mode default):
  Template gallery: cards with name, win rate, usage count
  Monaco Python editor with live preview
  "Run Preview" → bit distribution + backtest equity curve

All modes show footer bar:
  Tick #841 | 00:04:12 | Balance: $49.12 | Stake: 2/tick | Mult: 2.0x | ~24 ticks left
  [DEPOSIT] [WITHDRAW] [SUBMIT]
```

**3. Feedback — Tick resolution:**

```
Tick resolves → results appear inline

Per-market results row:
  BTC ✓ (+2.1%)   ETH ✗ (-0.3%)   SOL REFUND (+2%, below 30% threshold)

Summary bar:
  "Tick #841: 7/10 correct | +$1.82 | Balance: $49.12 | ~24 ticks left"

History strip updates with new tick result
```

**4. The loop continues:**

```
No "completion" — perpetual.
Loop: predict → wait → resolve → predict again

Exit signals:
  - Balance depleted: "Deposit more or withdraw remaining"
  - Voluntary exit: [WITHDRAW] → claim remaining (0.3% fee)
  - Bot graduation: strategy running → UI becomes monitoring dashboard
```

## Visual Design Foundation

### Color System

**Base palette (inherited, no changes):**

| Token | Value | Usage |
|-------|-------|-------|
| `--page` | `#FFFFFF` | Page background |
| `--surface` | `#F5F5F5` | Cards, secondary surfaces |
| `--black` | `#000000` | Primary text, section bars, headers |
| `--text-primary` | `#1A1A1A` | Body text |
| `--text-secondary` | `#555555` | Secondary labels |
| `--text-muted` | `#999999` | Tertiary, timestamps |
| `--border` | `#E0E0E0` | Dividers, card borders |
| `--up` | `#16A34A` | Positive change, wins |
| `--down` | `#DC2626` | Negative change, losses |

**Heatmap intensity scale (inherited from VisionMarketsGrid):**

| Class | Background | Meaning |
|-------|-----------|---------|
| `heat-up-1` | `#f0fdf4` | +0-2% |
| `heat-up-2` | `#dcfce7` | +2-5% |
| `heat-up-3` | `#bbf7d0` | +5-10% |
| `heat-up-4` | `#86efac` | +10%+ |
| `heat-down-1` | `#fef2f2` | -0-2% |
| `heat-down-2` | `#fee2e2` | -2-5% |
| `heat-down-3` | `#fecaca` | -5-10% |
| `heat-down-4` | `#fca5a5` | -10%+ |

**P2Pool-specific additions:**

| Token | Value | Usage |
|-------|-------|-------|
| `--tick-active` | `#3B82F6` | Current tick in progress |
| `--tick-resolved` | `#6B7280` | Past resolved ticks |
| `--tick-upcoming` | `#F59E0B` | Your committed future ticks |
| `--refund` | `#F59E0B` | All-losers refund indicator (amber) |

**Category accent strip colors (for composite batch headers):**

| Category | Color | Hex |
|----------|-------|-----|
| Crypto | Amber | `#F59E0B` |
| Stocks | Blue | `#3B82F6` |
| Weather | Cyan | `#06B6D4` |
| Predictions | Violet | `#8B5CF6` |
| Tech | Emerald | `#10B981` |
| Macro | Slate | `#6B7280` |
| Commodities | Orange | `#D97706` |
| Entertainment | Pink | `#EC4899` |
| Transport | Gray | `#64748B` |

These are used in batch card composite mosaic headers — each segment colored proportional to the category's market count in that batch.

### Typography System

**Fully inherited, no changes:**

| Role | Font | Weight | Size | Tracking |
|------|------|--------|------|----------|
| Page title | Inter | 900 | 42px | -0.03em |
| Section title | Inter | 900 | 32px | -0.02em |
| Card title | Inter | 800 | 15px | — |
| Eyebrow | Inter | 600 | 11px | 0.12em uppercase |
| Body | Inter | 400-500 | 14px | — |
| Data value | JetBrains Mono | 700-800 | 12-22px | tabular-nums |
| Data label | Inter / Mono | 600-700 | 10-11px | 0.06-0.1em uppercase |
| Code editor | JetBrains Mono | 400-500 | 13px | — |
| Tick countdown | JetBrains Mono | 700 | 16px | tabular-nums |

### Spacing & Layout Foundation

**Grid system:**
- Max content width: `1280px`
- Page padding: `48px` horizontal (desktop), `24px` (tablet), `16px` (mobile)
- Base unit: `4px` — all spacing is multiples of 4

**Batch card grid:**
- Desktop: 2-3 columns, auto-fill with `min-width: 400px`
- Tablet: 1-2 columns
- Gap: `1px` (tight grid, heatmap style — border IS the gap)

**Expanded batch layout:**
- Full width of content area
- Market rows: `48px` row height, `1px` gap
- Footer bar: fixed at bottom of expanded area, `56px` height

**Density philosophy:**
- Tight everywhere. `1px` gaps between tiles, `10-14px` cell padding, compact rows.
- White space is earned — section dividers (3px black) and section headers (black bars) create breathing room, not padding.
- Information density targets Bloomberg, not Airbnb.

### Accessibility Considerations

**Contrast ratios (WCAG AA):**
- `--black` on `--page`: 21:1 (AAA)
- `--text-secondary` on `--page`: 7.2:1 (AA)
- `--text-muted` on `--page`: 3.9:1 (AA large text only — acceptable for labels)
- `--up` on `--page`: 4.6:1 (AA)
- `--down` on `--page`: 5.4:1 (AA)

**Color-blind safety:**
- Win/loss uses green/red AND check/cross symbols (✓/✗) — never color alone
- Up/down arrows (▲/▼) accompany color indicators
- Heatmap intensity uses color AND sort order

**Keyboard navigation:**
- Tab through batch cards → Enter to expand → Tab through market rows → Space to toggle ▲/▼
- Escape to collapse expanded card
- Monaco editor has full keyboard support built-in

**Reduced motion:**
- Tick countdown: static number fallback
- Heatmap transitions: instant color change
- Card expansion: instant open/close
