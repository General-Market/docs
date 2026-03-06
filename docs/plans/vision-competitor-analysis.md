# Vision — Competitor Content Gap Analysis

**Session**: 20260227 — Competitive SEO research for Vision docs
**Goal**: Scan competitor sites, find what they're missing, identify 5 topics Vision should cover to be more helpful than everyone else.

---

## Competitors Scanned

| Platform | Type | Why they compete |
|----------|------|-----------------|
| Polymarket | CLOB prediction market | Dominant player, 90%+ volume |
| Kalshi | Regulated prediction exchange | US-regulated, event contracts |
| Azuro | On-chain betting protocol | Decentralized, liquidity pools |
| Manifold | Play-money prediction market | Community/education focused |
| Metaculus | Forecasting platform | Research/accuracy focused |

## Progress

- [x] Polymarket scan — DONE
- [x] Kalshi scan — DONE
- [x] Azuro scan — DONE
- [x] Manifold + Metaculus scan — DONE
- [x] Gap synthesis & 5 topics — DONE

---

## Per-Competitor Findings

### Polymarket

**Strong**: API/developer docs (100+ pages, SDKs, OpenAPI specs), fee documentation (exact formula published)
**Weak/Missing**:
- CRITICAL: Zero trading strategy guides
- CRITICAL: Zero risk/bankroll management content
- CRITICAL: Zero competitor comparison pages (third-party sites own all "Polymarket vs X" queries)
- HIGH: Minimal "what is prediction markets" education (400-word FAQ, no depth, no citations)
- HIGH: No backtesting tools (third-party PolyBackTest fills the gap)
- HIGH: No performance analytics — no win rate, Sharpe, drawdown
- HIGH: No historical data explorer or calibration analysis
- MEDIUM: No end-to-end system explainer (scattered across 15+ pages)
- MEDIUM: No bot-building tutorial despite having SDK and GitHub agents repo

**Key insight**: All strategy/education content is produced by third parties (Laika Labs, CryptoNews, PolyBackTest). Polymarket gives away the entire SEO surface for trader education.

---

### Kalshi

**Strong**: CFTC regulation narrative, fee docs, some strategy articles on Substack (swing trading, day trading, arbitrage), academic research arm (Harvard/Stanford/Yale collabs)
**Weak/Missing**:
- CRITICAL: No backtesting tools whatsoever (community-built only)
- CRITICAL: No position sizing / bankroll management math (Kelly, risk-of-ruin)
- CRITICAL: No bot-building tutorial despite having API + SDKs
- HIGH: Content scattered across 3 domains (help.kalshi.com, news.kalshi.com, kalshi.com/blog) — no unified curriculum
- HIGH: Only one competitor comparison page (election-focused Kalshi vs Polymarket)
- HIGH: No portfolio construction, hedging, or spread trading guides
- HIGH: No probability estimation methodology (how to convert beliefs into fair prices)
- MEDIUM: Glossary is 10-15 orphan SEO pages, not a real index
- MEDIUM: Academic research exists but zero translation to accessible content

**Key insight**: Kalshi has the most strategy content of any competitor but it's thin Substack posts, not deep guides. Nobody teaches the math.

---

### Azuro

**Strong**: React SDK docs (30+ hooks), LiquidityTree data structure docs (unique), B2B2C ecosystem framing, reward distribution transparency
**Weak/Missing**:
- CRITICAL: Zero end-user betting guides (how to bet, read odds, manage bankroll)
- CRITICAL: No bot/programmatic betting docs outside React
- CRITICAL: Blog dead since Nov 2024
- HIGH: No vAMM mathematical specification (core innovation undocumented)
- HIGH: No strategy content of any kind
- MEDIUM: Competitive landscape buried deep, no SEO comparison pages
- MEDIUM: No LP performance data despite LPs being core to protocol
- MEDIUM: No responsible gambling content

**Key insight**: Azuro invested in developer docs but completely ignored bettor education. Their Knowledge Hub is a whitepaper, not a user guide.

---

### Manifold Markets

**Strong**: Play-money removes barriers, anyone-can-create-markets, Predictle daily game, gamification (Leagues/Quests/Streaks), 86k-subscriber newsletter, platform-wide calibration page (Brier score 0.172 across 91k trades)
**Weak/Missing**:
- HIGH: No structured forecasting curriculum (beginner to advanced)
- HIGH: No interactive calibration trainer (Predictle tests ordering, not estimation)
- MEDIUM: No official strategy guide (community posts only)
- MEDIUM: No video tutorials
- MEDIUM: No domain-specific calibration breakdown

**Key insight**: Manifold makes prediction markets fun and accessible but doesn't teach you to get better. Education is incidental, not intentional.

---

### Metaculus

**Strong**: FutureEval (human vs AI benchmark), Bot Tournaments ($175k/yr prizes), Fortified Essays, three-metric scoring system (Peer + Baseline + Coverage), academic credibility (Lancet, arXiv), Pro Forecaster program
**Weak/Missing**:
- HIGH: No structured curriculum despite being the most "educational" platform
- HIGH: Links to aging GJP research (2011-2015) instead of building own tools
- MEDIUM: No interactive calibration practice built in
- MEDIUM: Scoring system is complex with no simple explanation
- MEDIUM: No video content

**Key insight**: Metaculus is the most intellectually serious platform but still doesn't teach forecasting methodology in a structured way. Their content is high-quality but scattered.

---

## Cross-Competitor Gap Matrix

What NOBODY does well:

| Gap | Poly | Kalshi | Azuro | Manifold | Metaculus |
|-----|------|--------|-------|----------|-----------|
| Trading/betting strategy guides | 0 | 2/10 | 0 | 1/10 | 3/10 |
| Position sizing / bankroll math | 0 | 0 | 0 | 0 | 0 |
| Backtesting tools or guides | 0 | 0 | 0 | 0 | 0 |
| "How to estimate probabilities" | 0 | 0 | 0 | 0 | 2/10 |
| Bot-building tutorial (end-to-end) | 0 | 0 | 0 | 0 | 3/10 |
| Competitor comparison pages | 0 | 1/10 | 1/10 | 0 | 0 |
| Post-mortem analysis (why crowd was wrong) | 0 | 0 | 0 | 0 | 0 |
| Structured learning path | 0 | 0 | 0 | 0 | 1/10 |
| Performance analytics (Sharpe, calibration) | 0 | 1/10 | 0 | 4/10 | 7/10 |
| Risk management for traders | 0 | 1/10 | 0 | 0 | 0 |

**The pattern is unmistakable**: The entire prediction market industry has outsourced education to third parties. Nobody teaches you how to actually get good. This is the opening.

---

## THE 5 TOPICS — What Vision Should Cover to Win

### 1. "How to Build a Prediction Market Bot" (End-to-End Guide)

**Why this wins**: Every competitor has API docs but ZERO have a "build your first bot" tutorial. Polymarket has a GitHub agents repo with no walkthrough. Kalshi has SDKs with no strategy implementation. Azuro only documents React hooks.

**What Vision uniquely offers**: Vision is designed for bots. The Python strategy system, bitmap encoding, and data-node API are bot-native. Vision can publish the ONLY complete tutorial in the industry: install dependencies -> connect to data node -> write strategy -> backtest -> encode bitmap -> submit on-chain -> monitor P&L.

**Content structure**:
- Part 1: Your first strategy (momentum template, 20 lines of Python)
- Part 2: Backtesting it against historical ticks
- Part 3: Going live — bitmap encoding, hash submission, deposit flow
- Part 4: Multi-batch strategies and position management
- Part 5: Advanced — custom data sources, ML models, risk controls

**SEO targets**: "prediction market bot tutorial", "how to build a trading bot for prediction markets", "algorithmic prediction market trading", "crypto prediction bot"

**Competitive moat**: Nobody can copy this because no other platform has bitmap-based batch betting with a built-in Python strategy system. The tutorial IS the product demo.

---

### 2. "The Math of Prediction Markets" (Position Sizing, EV, and Bankroll Management)

**Why this wins**: Scored 0/10 across ALL five competitors. Nobody teaches the math. Kalshi mentions Kelly Criterion in passing. Third-party blogs (Crypticorn, CamusoCPA) own this search intent with thin content.

**What Vision uniquely offers**: Vision's parimutuel model with side matching creates a cleaner mathematical framework than CLOB markets. The formulas are deterministic — a quant can model EV precisely. Vision can teach the math using its own system as the worked example.

**Content structure**:
- Expected Value in parimutuel markets (how side matching determines your odds)
- Kelly Criterion applied to sealed bets (betting without knowing the odds)
- Bankroll management: stake-per-tick sizing, deposit longevity
- Multiplier math: early_mult and commitment_mult tradeoffs
- Portfolio theory across batches (correlation between crypto markets, diversification)
- Worked examples with real Vision tick data

**SEO targets**: "prediction market Kelly criterion", "bankroll management prediction markets", "expected value binary betting", "position sizing prediction markets"

**Competitive moat**: Vision's deterministic formulas make the math teachable. CLOB markets have dynamic odds that are harder to model. Vision's sealed parimutuel + side matching is a cleaner pedagogical framework.

---

### 3. "Why Crowds Get It Wrong" (Post-Mortem Analysis Series)

**Why this wins**: Scored 0/10 across ALL five competitors. Nobody publishes systematic analysis of prediction failures. Metaculus has Fortified Essays but they're forward-looking, not retrospective. This is the highest-value educational content possible and nobody makes it.

**What Vision uniquely offers**: Vision resolves thousands of ticks per day across 50k+ markets. Every tick is a testable prediction with a known outcome. Vision has an unmatched dataset for analyzing when and why the crowd (or the majority side) was wrong.

**Content structure** (recurring series, one per week/month):
- "The tick where everyone bet UP" — what happens when one side is 90%+ of capital
- "When momentum fails" — crypto markets that reversed after strong trends
- "The Polymarket market that resolved wrong" — comparing Vision's resolution vs. Polymarket's oracle disputes
- "Weather surprises" — non-financial markets where prediction is hardest
- "What the winning bots saw" — anonymized strategy analysis from top performers

**SEO targets**: "prediction market accuracy", "why prediction markets fail", "prediction market mistakes", "crowd wisdom wrong", "prediction market case study"

**Competitive moat**: Vision's tick-by-tick resolution data across 50k markets is a dataset nobody else has. Polymarket resolves maybe 100 markets per week. Vision resolves thousands of micro-outcomes per day.

---

### 4. "Vision vs Polymarket vs Kalshi" (Honest Comparison Page)

**Why this wins**: Polymarket has zero comparison pages. Kalshi has one election-focused piece. Third-party review sites (ActionNetwork, RotoGrinders, OddsShark, Techopedia) own ALL "X vs Y" search queries. This traffic is high-intent — people searching this are deciding where to trade.

**What Vision uniquely offers**: Vision can be honest about what it is and isn't. It's not trying to be Polymarket (event markets) or Kalshi (regulated exchange). It's a sealed parimutuel system designed for bots and quants. The comparison page can own the narrative instead of letting third parties define it.

**Content structure**:
- Feature comparison table (markets, fees, resolution, minimum bet, bot support, privacy)
- "When to use Polymarket" (discrete event markets, manual trading, large markets)
- "When to use Kalshi" (US-regulated, tax reporting, event contracts)
- "When to use Vision" (high-frequency, bot-native, sealed bets, massive market count, multi-market batches)
- Fee comparison with worked examples
- Bot experience comparison (API complexity, strategy tools, backtesting)
- Privacy comparison (public orderbook vs sealed bitmaps)

**SEO targets**: "Polymarket vs Kalshi", "best prediction market platform", "prediction market comparison 2026", "Polymarket alternatives", "on-chain prediction market comparison"

**Competitive moat**: Being the ONLY platform with an honest comparison page (admitting when competitors are better for certain use cases) builds trust. Third-party review sites can't match the technical depth of an insider comparison.

---

### 5. "The Prediction Market Strategy Handbook" (From Zero to Quant)

**Why this wins**: The biggest gap across the entire industry. Every platform treats strategy as someone else's problem. Third-party content is thin (500-word blog posts) and generic. Nobody has published a comprehensive, structured guide to prediction market strategy.

**What Vision uniquely offers**: Vision's design makes strategy more interesting than any other platform. Sealed bitmaps mean you're estimating hidden odds. Side matching means minority positions get better returns. Multipliers reward conviction. Multi-market batches create portfolio dynamics. This is a richer strategy space than "buy YES at 60 cents."

**Content structure** (a living handbook, 10+ chapters):
1. How prediction markets actually work (parimutuel vs CLOB vs AMM)
2. Probability estimation from first principles (base rates, Bayesian updating, decomposition)
3. The sealed bet advantage (information asymmetry in hidden-odds markets)
4. Momentum strategies (trend-following across crypto markets)
5. Contrarian strategies (why minority side returns are higher)
6. Multi-market batch strategy (correlation, diversification, sector rotation)
7. Time-based strategies (early multiplier optimization, commitment tradeoffs)
8. Backtesting your strategy (using Vision's historical data)
9. Risk management (stake sizing, max drawdown, when to stop)
10. From manual to automated (turning strategy into a Python script)

**SEO targets**: "prediction market strategy guide", "how to win at prediction markets", "prediction market trading strategies", "parimutuel betting strategy", "prediction market for beginners"

**Competitive moat**: This handbook teaches concepts using Vision's system as the running example. Every chapter is both education AND product tutorial. Readers learn strategy and learn Vision simultaneously. Nobody can replicate this because the strategy concepts are tied to Vision's unique mechanics (sealed bets, side matching, multipliers, batches).

---

## Why These 5 Win the #1 Spot

| Topic | Competitors covering it | Third parties covering it | Search demand |
|-------|------------------------|--------------------------|---------------|
| Bot tutorial | 0/5 | Scattered GitHub repos | HIGH (developers searching) |
| Math/bankroll | 0/5 | Thin blog posts (Crypticorn) | HIGH (serious traders) |
| Post-mortems | 0/5 | Nobody | MEDIUM (unique content play) |
| Comparison page | 0.2/5 | Review sites own it all | VERY HIGH (buying intent) |
| Strategy handbook | 0/5 | Thin 500-word articles | VERY HIGH (everyone wants this) |

**The pattern**: Every topic scores near-zero coverage from competitors AND has demonstrated search demand from third-party content filling the vacuum. Vision doesn't need to outspend — it needs to out-teach. Whoever explains prediction markets best owns the audience.

---

## Implementation Priority

1. **Comparison page** — fastest to write, highest buying intent, captures traffic immediately
2. **Bot tutorial** — directly showcases Vision's unique product (Python strategies, bitmap system)
3. **Strategy handbook** — ambitious but becomes the canonical resource, drives long-term organic traffic
4. **Math guide** — pairs with handbook, establishes intellectual credibility
5. **Post-mortem series** — recurring content engine, keeps the site fresh for crawlers
