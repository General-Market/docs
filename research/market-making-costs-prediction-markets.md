# Market Making Costs in Prediction Markets

> Research compiled March 27-28, 2026. All figures verified via primary sources, APIs, and academic papers.

---

## Executive Summary

Polymarket and Kalshi each spend an estimated **$12-25M/year** on market making and liquidity subsidies to maintain ~35-57K real markets. This cost scales linearly with market count — every new market needs its own pool of capital and incentive budget. The order book model has a ceiling.

General Market's parimutuel architecture eliminates this cost entirely. With **180,000+ live markets** and **583,551 total markets created**, it operates at **$0 in market making spend** — because the mechanism doesn't require market makers. Players trade against each other in sealed-bet pools. The pool itself is the counterparty.

---

## 1. Kalshi Market Making Costs

### Disclosed Figures

| Item | Amount | Source |
|------|--------|--------|
| Daily liquidity incentive spend | **~$35,000/day** | [Fifty Cent Dollars](https://fiftycentdollars.substack.com/p/kalshis-new-liquidity-incentives) |
| **Annualized** | **~$12.7M/year** | Derived |
| Market maker rebates | Up to 1% per trade | [Blondie Predicts](https://blondiepredicts.substack.com/p/unpacking-kalshis-incentive-programs) |
| Weekly rebate cap per maker | $7,000 | [Blondie Predicts](https://blondiepredicts.substack.com/p/unpacking-kalshis-incentive-programs) |
| Volume incentive pool per market | $300-$10,000 | [Blondie Predicts](https://blondiepredicts.substack.com/p/unpacking-kalshis-incentive-programs) |
| Daily liquidity pool per market | $10-$1,000 | [Blondie Predicts](https://blondiepredicts.substack.com/p/unpacking-kalshis-incentive-programs) |
| Depositor interest (cash) | Up to 4.05% APY | Kalshi platform |

### Revenue Context

| Metric | Value |
|--------|-------|
| 2025 revenue | $260M |
| 2025 volume | $22.88B |
| Fee rate | ~1.2% of volume |
| Taker fees | 0.07%-7% depending on contract probability |
| Liquidity spend as % of revenue | ~5% |
| Annualized pace (late 2025) | $600-700M net revenue |
| Valuation (March 2026) | Seeking $20B |

**Sources:** [Sacra](https://sacra.com/c/kalshi/), [Cryptopolitan](https://www.cryptopolitan.com/kalshi-starts-2026-hot-after-record-2025/)

---

## 2. Polymarket Market Making Costs

### Estimated Figures

| Item | Amount | Source |
|------|--------|--------|
| Estimated monthly liquidity spend (pre-sports) | ~$300,000/month | Analyst estimate (unconfirmed) |
| **Annualized (pre-sports expansion)** | **~$3.6M/year** | Derived |
| **Estimated current annualized (with sports)** | **$15-25M/year** | Derived from per-event rates below |

### Per-Event Incentive Rates (Polymarket US)

From [Polymarket US Liquidity Incentive Program](https://docs.polymarket.us/incentives/liquidity):

| Sport / Event | Per-Game Amount | Breakdown |
|---------------|-----------------|-----------|
| NCAA March Madness (men's) | **$100,000** | $66K moneyline + $22.5K spreads + $11.5K totals |
| NBA Tier 1 | **$50,000** | $30K moneyline + $12.5K spreads + $7.5K totals |
| NBA Tier 2 | $20,000 | Split across instruments |
| NCAAW (women's) | $20,000 | Split across instruments |
| MLB | $20,000 | Split across instruments |
| EPL | $10,000 | Split across instruments |
| ATP / WTA | $2,500 | Per match |
| March Madness Futures | $10,000/day | Per instrument |
| MLB Futures | $5,000/day | Per instrument |
| EPL/UCL/MLS Futures | $2,500/day each | Per instrument |

Each per-game amount covers all instruments (moneyline, spreads, totals) across three time windows (early, day-of, live). Amounts are per game, not per instrument.

### Calibration Check

Polymarket announced **$2M total** for all NCAA March Madness liquidity rewards ([Polymarket Sports on X](https://x.com/PolymarketSport/status/2033913388284125500)). At $100K/game, that covers ~20 games at full rate -- not the entire 67-game tournament.

### Holding Rewards & Fee Redistribution

| Item | Detail |
|------|--------|
| Holding rewards | 4% APY on select political markets (treasury-funded) |
| Crypto fee redistribution to LPs | 20% of taker fees |
| Sports fee redistribution to LPs | 25% of taker fees |
| New fee structure (March 30, 2026) | Taker fees expanding to most categories |
| Projected fee revenue | ~$1M/day |

### Revenue Context

| Metric | Value |
|--------|-------|
| Historical revenue (2020-2025) | $0 (fee-free for 5+ years) |
| Fee structure | 0% historically; 0.01% planned for US relaunch |
| Market maker collective earnings (2024) | >$20M |
| Series B | $70M (May 2024, Founders Fund) |
| ICE investment | $2B |
| Valuation | ~$9-12B |

**Sources:** [Revenue Memo](https://www.revenuememo.com/p/how-does-polymarket-make-money), [Polymarket Liquidity Rewards docs](https://docs.polymarket.com/developers/market-makers/liquidity-rewards), [WEEX](https://www.weex.com/news/detail/four-key-truths-and-cost-traps-behind-polymarket-lp-market-making-incentives-400664), [Finbold](https://finbold.com/polymarket-set-to-earn-around-1-million-a-day-with-upcoming-fee-structure/)

---

## 3. Market Count Comparison (API-Verified, March 27, 2026)

An "event" is a distinct question ("Will Trump win?"). Each event spawns multiple binary contracts -- one per possible outcome. A "market" or "contract" is a single tradeable yes/no position.

### Polymarket (Gamma API, full pagination)

| Metric | Count | Method |
|--------|-------|--------|
| **Active events** | **9,654** | `gamma-api.polymarket.com/events?closed=false&active=true` |
| **Binary contracts within those events** | **56,955** | Nested `markets[]` in event responses |
| Active contracts (market endpoint) | 39,888 | `gamma-api.polymarket.com/markets?closed=false&active=true` |
| Shown on polymarket.com | 1,361 | Website curated display |
| **All-time binary contracts** | **101,000+** | CLOB API (pagination capped at 101 pages) |
| **All-time events** | **50,000+** | Gamma API unfiltered |
| Contracts per event (avg) | 5.9 | Computed |

The gap between 1,361 (website) and 9,654 (API) reflects the website's curated default filters -- sports lines, CYOM markets, and niche predictions are hidden from browse but fully tradeable via API.

### Kalshi (API-Verified, March 25, 2026)

| Metric | Count | Method |
|--------|-------|--------|
| "Open" markets (headline) | **586,000** | API pagination, `status=open` |
| **Real standalone markets** | **~35,000** | Excluding MVE combo/parlay shells |
| **Actual events** | **~4,000** | Distinct event groupings |
| MVE combo/parlay shells | ~530,000 | Auto-generated multi-leg combinations |
| Markets with zero volume | ~490,000 | Never traded |
| Markets with any volume | ~96,000 | 13% of headline |
| **All-time events** | **~40,000** | [GitHub: Kalshi Data](https://github.com/Ismat-Samadov/kalshi_com) |
| **All-time contracts** | **~157,000** | [GitHub: Kalshi Data](https://github.com/Ismat-Samadov/kalshi_com) |

### General Market (Verified March 25, 2026)

| Metric | Count | Method |
|--------|-------|--------|
| **Live tradeable markets** | **180,000+** | All genuine, all accepting bets |
| **Total markets created (lifetime)** | **583,551** | Includes resolved markets |
| Market making cost | **$0** | Parimutuel -- no market makers exist |
| Data sources | 94 | Across 90 modules |

### What Are Kalshi's 530K Combo Markets?

**MVE = Multivariate Event.** Kalshi auto-generates multi-leg contracts from a CFTC self-certified template: "Will [outcomes] occur in [events]?" ([CFTC filing, September 2, 2025](https://www.cftc.gov/sites/default/files/filings/ptc/25/09/ptc09022529868.pdf)).

**Mechanics:**
- Bundle 2+ binary yes/no contracts into a single position
- All legs must resolve YES for $1.00 payout; any leg NO = $0.00
- Created via RFQ (Request for Quote) -- not placed on a visible order book initially
- Institutional market makers receive the RFQ and quote a price
- Once filled, the combo gets its own order book for secondary trading

**Pricing reality:**
- Effective vig: 15-20% on multi-leg combos (hidden in spread)
- A 3-leg combo bought for $1.00 could only be sold for $0.86 seconds later ([Sportico](https://www.sportico.com/business/sports-betting/2025/kalshi-parlay-combo-rfq-explainer-1234877038/))
- Another test: $0.91 combo cashed out at $0.68 immediately

**Growth trajectory:**
- 700 new markets/month (Oct 2024) to 37,806/month (Jan 2026) -- 37x increase in 15 months
- Driven almost entirely by combinatorial generation from eligible underlying markets

**Sources:** [Kalshi API docs](https://docs.kalshi.com/api-reference/events/get-multivariate-events), [Sportico](https://www.sportico.com/business/sports-betting/2025/kalshi-parlay-combo-rfq-explainer-1234877038/), [RotoGrinders](https://rotogrinders.com/articles/kalshi-fully-launches-combos-feature-for-parlay-style-prediction-markets-4177461), [GitHub: Kalshi Data](https://github.com/Ismat-Samadov/kalshi_com)

### Summary Table

| Platform | Active Events | Active Contracts | Lifetime Events | Lifetime Contracts | Inflated Headline |
|----------|--------------|-----------------|-----------------|-------------------|-------------------|
| Kalshi | ~4,000 | ~35,000 | ~40,000 | ~157,000 | 586,000 (530K auto-combos) |
| Polymarket | **9,654** | **56,955** | **50,000+** | **101,000+** | None |
| **General Market** | **--** | **180,000+** | **--** | **583,551** | **None** |

Polymarket has 2.4x more active events and 1.6x more real contracts than Kalshi. General Market has 3.2x more live markets than Polymarket and 5.1x more than Kalshi -- with zero liquidity spend.

---

## 4. Unit Economics: Cost Per Market

| | Polymarket | Kalshi | General Market |
|---|---|---|---|
| Estimated annual liquidity spend | $15-25M | $12.7M | **$0** |
| Real active markets | ~57,000 | ~35,000 | **180,000+** |
| **Cost per market/year** | **$260-440** | **$360** | **$0** |
| **Cost per market/day** | **$0.70-1.20** | **$1.00** | **$0** |
| Fee per trade | ~$0.09 (1.75% peak taker) | ~$0.02 (1.75c/contract) | **$0** |
| **Cost of 10M trades/day** | **~$900,000** | **~$175,000** | **$0** |

The distribution is heavily skewed on CLOB platforms. A handful of sports and political markets consume 80%+ of the budget. The median market receives $0.10/day or less. Median Kalshi event volume: $709 ([GitHub: Kalshi Data](https://github.com/Ismat-Samadov/kalshi_com)).

---

## 5. Why General Market Operates 180K+ Markets at Zero Cost

The order book model has a structural defect: every market needs someone willing to stand on the other side. That someone must be paid. The more markets you create, the more you pay. This is why Polymarket and Kalshi spend $12-25M/year and still can't keep most of their long-tail markets liquid.

General Market eliminates this cost by eliminating the order book entirely.

### The Parimutuel Architecture

```
ORDER BOOK (Polymarket/Kalshi)          PARIMUTUEL POOL (General Market)

Buyer -----> Order Book <----- Seller   Player A ---\
  |            |                                      +--> Sealed Pool --> Settlement
Market Maker (paid to exist)            Player B ---/
  |
Spread = market maker's profit          No spread. No market maker. No cost.
```

**How it works:**

1. **Players deposit into a sealed-bet pool.** Each player commits a stake and an encrypted prediction (bitmap hash). No order book. No bid/ask spread. No price discovery during the betting window.

2. **Positions are invisible until settlement.** Sealed bets mean no one can front-run, copy, or react to other players' positions. This removes the adverse selection problem that makes market making expensive.

3. **The pool is the counterparty.** Winners are paid from losers' deposits. `sum(payouts) <= sum(deposits)` -- the pool is always solvent by construction. No leverage, no margin, no liquidation risk.

4. **Settlement is oracle-driven.** BLS-signed oracle consensus resolves outcomes every tick (2 minutes to 24 hours depending on the batch). No human market maker adjudicates prices.

5. **Protocol fee: 0.3% on profits only.** Not on deposits, not on volume -- only on net wins. A player who breaks even pays nothing.

### Why This Scales Where Order Books Can't

| Problem | Order Book (Polymarket/Kalshi) | Parimutuel (General Market) |
|---------|-------------------------------|----------------------------|
| New market needs liquidity | Must pay market makers to quote | Players provide liquidity by betting |
| Thin market = wide spreads | Yes -- unusable below ~$10K daily volume | No spreads exist. Thin or thick, same mechanics |
| Cost scales with market count | Linearly -- each market needs its own subsidy | **Zero marginal cost per market** |
| Long-tail markets | Die from illiquidity -- no maker will quote | Function identically to popular markets |
| Market maker adverse selection | LPs lose to informed traders (net -10% on Kalshi) | Sealed bets eliminate information leakage |
| Inventory risk | Unhedgeable -- binary contracts can't be hedged | No inventory. Pool settles atomically |

### The Numbers

General Market runs **94 data sources** across 90 modules, auto-generating markets from real-world data feeds:

| Data Source | Live Markets | Category |
|-------------|-------------|----------|
| Solar Observatory | ~180,000 | Space |
| Pump.fun | ~95,500 | Crypto |
| Steam | ~23,508 | Gaming |
| McDonald's ice cream machines | ~14,291 | Consumer |
| Deutsche Bahn | ~847 | Transport |
| Military Aircraft (ADS-B) | varies | Defense |
| + 88 more sources | ... | ... |
| **Total live** | **180,000+** | |
| **Total lifetime** | **583,551** | |

Every one of these markets is genuine, tradeable, and accepting bets. No combos, no shells, no inflation. The cost to add 100,000 more markets is the cost of connecting one more data source -- not $36M/year in market maker subsidies.

### The Structural Advantage, Quantified

To match General Market's 180,000 live markets using the order book model:

| Platform | Markets | Cost/Market/Year | Annual Cost to Match 180K Markets |
|----------|---------|-----------------|----------------------------------|
| Kalshi | 35,000 | $360 | **$64.8M/year** |
| Polymarket | 57,000 | $260-440 | **$46.8-79.2M/year** |
| **General Market** | **180,000+** | **$0** | **$0** |

The order book model breaks at scale. You can subsidize 35,000 markets. You cannot subsidize 180,000. The parimutuel pool doesn't ask you to.

---

## 6. Resolution Sources & Data Providers

### Kalshi: ~20-25 Distinct Resolution Sources

Centralized -- one Markets Team adjudicates everything using per-contract source hierarchies filed with the CFTC. Each contract has a filed source priority list; the team walks it top-down.

| Category | Primary Resolution Sources |
|----------|--------------------------|
| Sports | League governing bodies, **STATSCORE** (3-year deal), AP, ESPN, Fox Sports, WSJ |
| Economics | **BLS** (CPI, unemployment), **BEA** (GDP), **Federal Reserve** (rates), Zillow (housing), FRED |
| Weather | **NWS Daily Climate Report** -- 4 cities only (NYC, Chicago, Miami, Austin). NOAA stations. AccuWeather/iOS Weather explicitly rejected |
| Elections | **Associated Press** (exclusive data deal, March 2026) |
| Crypto | **CF Benchmarks RTIs** exclusively (same indices as CME futures, UK FCA-authorized). Trimmed averaging: excludes top/bottom 20% |
| Entertainment | Rotten Tomatoes, Billboard, official ceremony organizers, entertainment press hierarchy |
| M&A/Corporate | Company IR filings > Bloomberg > Reuters > WSJ > FT > CNBC > NYT > AP |
| Legal/Court | PACER > Westlaw > Bloomberg Law > major wire services |

Critical detail: Kalshi uses **first-release data**, not revisions. If BLS initially reports 10.1% unemployment and later revises to 9.8%, the contract settles on 10.1%.

Failsafe: Rule 6.3(c) allows Kalshi to settle at last traded price if outcomes are deemed unresolvable.

**Sources:** [Kalshi Help: Weather Markets](https://help.kalshi.com/markets/popular-markets/weather-markets), [Kalshi Help: Crypto Markets](https://help.kalshi.com/markets/popular-markets/crypto-markets), [CF Benchmarks](https://www.cfbenchmarks.com/blog/kalshi-leads-surging-crypto-event-contract-market-powered-by-cf-benchmarks), [Axios: Kalshi-AP deal](https://www.axios.com/2026/03/02/kalshi-ap-elections-data), [STATSCORE partnership](https://www.statscore.com/news-center/statscore-news/statscore-and-kalshi-forge-strategic-three-year-partnership-to-elevate-sports-trading/), [DeFi Rate: How contracts settle](https://defirate.com/prediction-markets/how-contracts-settle/)

### Polymarket: ~10-15 Distinct Sources + 3 Oracle Systems

Decentralized on the international platform, centralized on the US entity.

**Three oracle systems:**

| Oracle | Platform | Used For |
|--------|----------|----------|
| **UMA Optimistic Oracle (MOOV2)** | International | Most markets. Whitelisted proposers (177 addresses), anyone can dispute, UMA token-holder vote on escalation |
| **Chainlink Data Streams** | International | Crypto price markets (automated settlement) |
| **Internal Markets Team** | Polymarket US (CFTC) | Direct adjudication, no community vote |

**Data sources by category:**

| Category | Resolution Sources |
|----------|-------------------|
| Sports | **Sportradar** (via NHL, MLS, MLB official data partnerships), league governing bodies |
| Elections | **AP + Fox News + NBC** (all three must call the race unanimously) |
| Crypto | **Chainlink Data Streams** (low-latency, verifiable), Binance spot |
| Weather | **NOAA**, Weather Underground (station-specific, e.g., London City Airport EGLC) |
| Policy/Legislation | **Federal Register**, official government sources |
| Everything else | "Consensus of credible reporting" -- NYT, CNN, WSJ, BBC must converge. No single source is authoritative |

UMA upgraded to MOOV2 (Managed Optimistic Oracle V2) in August 2025 -- proposals restricted to 177 whitelisted addresses. Incorrect proposals fell 59%, total disputes fell 68% in the first month.

**League partnerships timeline:**
- NHL: October 2025 (first major US league)
- MLS: January 2026
- MLB: March 2026 (multi-year exclusive, first-of-its-kind CFTC integrity pact)
- NFL, NBA: No deals yet

**Sources:** [Polymarket Resolution docs](https://docs.polymarket.com/concepts/resolution), [Polymarket + Chainlink PR](https://www.prnewswire.com/news-releases/polymarket-partners-with-chainlink-to-enhance-accuracy-of-prediction-market-resolutions-302555123.html), [UMA MOOV2 update](https://blog.uma.xyz/articles/managed-proposers-update), [MLB-Polymarket deal (ESPN)](https://www.espn.com/mlb/story/_/id/48248176/mlb-reaches-agreements-polymarket-federal-commission), [Sportico: NHL data](https://www.sportico.com/business/sports-betting/2025/nhl-kalshi-polymarket-data-sportradar-genius-1234874471/)

### General Market: 94 Automated Data Sources

No human resolution. No dispute process. Oracle consensus via BLS multi-signature across 3+ oracle nodes, settling outcomes from live data feeds every tick.

| Category | Example Sources | Markets Generated |
|----------|----------------|-------------------|
| Space | Solar Observatory (GOES satellite data) | ~180,000 |
| Crypto | Pump.fun (on-chain meme coin data) | ~95,500 |
| Gaming | Steam (player count API) | ~23,508 |
| Consumer | McDonald's (ice cream machine status API) | ~14,291 |
| Transport | Deutsche Bahn (IRIS-TTS train delay API) | ~847 |
| Defense | ADS-B Exchange (military aircraft transponders) | varies |
| + 88 more | Weather, DeFi, rates, blockchain, congress, bonds, esports... | ... |
| **Total** | **94 sources, 90 modules** | **180,000+ live** |

The key difference: Polymarket and Kalshi resolve markets by checking what humans reported. General Market resolves markets by reading what sensors, APIs, and blockchains recorded. No editorial judgment. No dispute window. No 177-address whitelist. The oracle reads the data, signs the result, and the pool settles.

### Resolution Source Comparison

| | Kalshi | Polymarket | General Market |
|---|---|---|---|
| Resolution model | Centralized Markets Team | 3 oracles (UMA, Chainlink, internal) | BLS oracle consensus |
| Distinct named sources | ~20-25 | ~10-15 | **94 automated feeds** |
| Human judgment required | Yes -- team walks source hierarchy | Partially (UMA disputes involve human voters) | **No** |
| Dispute mechanism | Internal arbitration | On-chain bond + token-holder vote | None needed -- deterministic |
| Sports data | STATSCORE | Sportradar | N/A (no sports markets) |
| Crypto feeds | CF Benchmarks (exclusively) | Chainlink + Binance | Direct on-chain reads |
| Time to resolution | Minutes to days | 2 hours to 6 days | **Seconds (per tick)** |

---

## 7. LP/Market Maker Economics

### Polymarket LP Returns (Practitioner Reports)

| Period | Returns | Source |
|--------|---------|--------|
| Early period | $200-300 USDC/day on ~$10K capital (2-3% daily) | Unsustainable, early-mover bonus |
| Mature target | ~10% annualized on long-dated, calm markets | [Medium](https://medium.com/@wanguolin/my-two-week-deep-dive-into-polymarket-liquidity-rewards-a-technical-postmortem-88d3a954a058) |
| One practitioner | $70K deployed, ~$57/day (~30% APY) | [Medium](https://medium.com/@wanguolin/my-two-week-deep-dive-into-polymarket-liquidity-rewards-a-technical-postmortem-88d3a954a058) |
| Collective maker earnings (2024) | >$20M, 5-15% monthly returns | [Finance Magnates](https://www.financemagnates.com/fintech/prediction-markets-scale-up-as-volumes-surge-but-regulation-and-liquidity-remain-key-constraints/) |

Many LPs experience net losses from adverse selection. The subsidy compensates for a structurally losing game.

### Kalshi Maker/Taker Returns (Academic)

From Whelan, Burgi & Deng, "Makers and Takers: The Economics of the Kalshi Prediction Market" (2025):

| Participant | Average Return |
|-------------|---------------|
| All participants (pre-fee) | **-20%** |
| Makers | **-10%** |
| Takers | **-32%** |

Analysis covered 300,000+ contracts. Strong favourite-longshot bias: 10-cent contracts win ~2% of the time (not 10%); 95-cent contracts win ~98%.

**Source:** [CEPR/VoxEU](https://cepr.org/voxeu/columns/economics-kalshi-prediction-market), [paper](https://www.karlwhelan.com/Papers/PredictionMarkets.pdf)

---

## 8. Traditional Market Making Comparison

### Why Prediction Markets Are Structurally More Expensive

| Property | Traditional Markets | Prediction Markets |
|----------|--------------------|--------------------|
| Hedging | Yes -- correlated instruments exist | **No** -- no derivative on "Will X happen?" |
| Settlement | Continuous price | **Binary** -- 0 or 1, total loss on wrong side |
| Inventory risk | Manageable via hedging | **Unhedgeable** |
| Market depth | Deep, institutional flow | Thin on most contracts |
| Volume distribution | Relatively even across instruments | **Extreme power law** -- top 50 events dominate |

### Scale Reference: Traditional Market Makers (2024)

| Firm | Revenue | Note |
|------|---------|------|
| Jane Street | $20.5B | $6.93M revenue per employee |
| Citadel Securities | $9.7B | $388M PFOF paid in Q1 2025 alone |
| Virtu Financial | $3.63B | $2.44B net trading income |

These firms profit from spread capture at massive scale with hedged inventory. Prediction market makers operate without this safety net.

---

## 9. Theoretical Foundations

### LMSR (Logarithmic Market Scoring Rule)

The foundational model for automated prediction market liquidity (Hanson, 2003):

- **Worst-case loss:** `b * ln(n)` where `b` = liquidity parameter, `n` = number of outcomes
- **Binary market:** worst-case loss = `0.693 * b`
- **By design, the market maker bleeds.** The loss is bounded but guaranteed -- it is the price of information.

**Source:** [Hanson, GMU](https://mason.gmu.edu/~rhanson/mktscore.pdf)

### Optimal Liquidity Subsidy Theory

Tetlock & Hahn (Columbia Business School): a rational decision-maker **should subsidize** prediction market liquidity because the information extracted improves expected social welfare. The subsidy does not produce socially optimal information acquisition, but it produces more than zero liquidity -- which is what a competitive market maker would provide.

**Source:** [Columbia](https://business.columbia.edu/sites/default/files-efs/pubfiles/4157/Optimal%20Liquidity%20Provision%20for%20Decision%20Makers.pdf)

### LMSR Subsidy Failure Case

IARPA prediction markets using QMSR (a variant): subsidies grew from 4,629 Inkles to **4,158,425 Inkles** -- a 900x increase that destroyed market functioning.

**Source:** [Cultivate Labs](https://www.cultivatelabs.com/posts/prediction-market-failure)

### The Parimutuel Alternative

The parimutuel model (from the French "mutual betting") predates all of the above. It was invented in 1867 by Joseph Oller for horse racing. The insight: if the pool is the counterparty, the house doesn't need to price individual bets. Liquidity is a function of participation, not of subsidized market makers.

Academic work (Das & Magdon-Ismail, "Comparing Prediction Market Structures") found that logarithmic scoring rules and dynamic parimutuel achieve the **highest forecasting accuracy and lowest losses** for operators among all prediction market mechanisms studied.

**Source:** [Das & Magdon-Ismail](https://people.cs.vt.edu/~sanmay/papers/predmarkets.pdf)

---

## 10. Industry Volume Context

| Metric | Value | Source |
|--------|-------|--------|
| Industry monthly volume (late 2025) | ~$13B/month | [Insights4VC](https://insights4vc.substack.com/p/prediction-markets-at-scale-2026) |
| Kalshi 2025 annual volume | $22.88B | [Sacra](https://sacra.com/c/kalshi/) |
| Polymarket 2024 annual volume | ~$9B | [Sacra](https://sacra.com/research/polymarket-vs-kalshi/) |
| Combined weekly volume (late 2025) | >$6B regularly | [The Block](https://www.theblock.co/post/383733/prediction-markets-kalshi-polymarket-duopoly-2025) |
| Single-day record | $702M | Industry reports |
| Super Bowl 2026 (Kalshi alone) | $1B+ | [Cryptopolitan](https://www.cryptopolitan.com/kalshi-starts-2026-hot-after-record-2025/) |
| Robinhood prediction markets revenue | ~$300M annualized | Fastest-growing line |

---

## 11. The Scaling Problem -- and Its Solution

Liquidity cannot be amortized under the order book model. Each market needs its own pool of capital and its own incentive budget. A presidential election attracts billions; a niche market gets tens of thousands. There is no shared event identity across platforms -- prices violate the Law of One Price across venues.

At Kalshi's rate of ~$35K/day across 35,000 real markets: **$1.00/day per market on average**. But the distribution is grotesquely skewed. The top markets get thousands per day. The long tail gets nothing and remains illiquid.

The cost to maintain liquid markets across tens of thousands of contracts scales roughly linearly with market count. This is the fundamental barrier to prediction market expansion -- and the reason both platforms concentrate subsidies on a narrow set of high-visibility events while letting the rest die quietly.

The parimutuel model dissolves this problem. Markets don't need liquidity providers because the pool is the liquidity. Adding 100,000 markets costs the same as adding 10 -- the infrastructure cost of connecting a data feed. General Market runs 180,000+ live markets across 94 data sources at zero marginal liquidity cost. The order book platforms cannot reach this number at any price they're willing to pay.

The prediction market industry spends $25-50M/year subsidizing the illusion that order books work for event contracts. They work for elections and Super Bowls. They fail for everything else. The long tail of human curiosity -- solar flares, train delays, ice cream machines, meme coins -- requires a mechanism that doesn't charge per market. The parimutuel pool is that mechanism.

---

## Sources Index

### Academic Papers
- [Hanson (2003): Logarithmic Market Scoring Rules](https://mason.gmu.edu/~rhanson/mktscore.pdf)
- [Tetlock & Hahn: Optimal Liquidity Provision for Decision Makers](https://business.columbia.edu/sites/default/files-efs/pubfiles/4157/Optimal%20Liquidity%20Provision%20for%20Decision%20Makers.pdf)
- [Tetlock (2008): Liquidity and Prediction Market Efficiency](https://business.columbia.edu/sites/default/files-efs/pubfiles/3098/Tetlock_SSRN_Liquidity_and_Efficiency.pdf)
- [Whelan, Burgi & Deng (2025): Makers and Takers](https://cepr.org/voxeu/columns/economics-kalshi-prediction-market) | [Paper](https://www.karlwhelan.com/Papers/PredictionMarkets.pdf)
- [Othman & Sandholm (2013): Practical Liquidity-Sensitive AMM](https://www.cs.cmu.edu/~sandholm/liquidity-sensitive%20automated%20market%20maker.teac.pdf)
- [Das & Magdon-Ismail: Comparing Prediction Market Structures](https://people.cs.vt.edu/~sanmay/papers/predmarkets.pdf)

### Platform Documentation
- [Polymarket US Liquidity Incentive Program](https://docs.polymarket.us/incentives/liquidity)
- [Polymarket Liquidity Rewards](https://docs.polymarket.com/developers/market-makers/liquidity-rewards)
- [Polymarket Fee Structure](https://docs.polymarket.com/trading/fees)
- [Polymarket Resolution Documentation](https://docs.polymarket.com/concepts/resolution)
- [Kalshi API: Multivariate Events](https://docs.kalshi.com/api-reference/events/get-multivariate-events)
- [Kalshi Help: Weather Markets](https://help.kalshi.com/markets/popular-markets/weather-markets)
- [Kalshi Help: Crypto Markets](https://help.kalshi.com/markets/popular-markets/crypto-markets)
- [CFTC Self-Certification Filing (Sept 2, 2025)](https://www.cftc.gov/sites/default/files/filings/ptc/25/09/ptc09022529868.pdf)

### Industry Analysis
- [Sacra: Polymarket vs Kalshi](https://sacra.com/research/polymarket-vs-kalshi/)
- [Sacra: Kalshi Revenue/Valuation](https://sacra.com/c/kalshi/)
- [Capital Founders: Prediction Markets Investor Framework](https://www.capitalfounders.io/playbooks/prediction-markets-investor-framework/)
- [Insights4VC: Prediction Markets at Scale 2026](https://insights4vc.substack.com/p/prediction-markets-at-scale-2026)
- [The Block: Prediction Market Duopoly](https://www.theblock.co/post/383733/prediction-markets-kalshi-polymarket-duopoly-2025)
- [Revenue Memo: How Polymarket Makes Money](https://www.revenuememo.com/p/how-does-polymarket-make-money)

### Journalism & Commentary
- [Fifty Cent Dollars: Kalshi Liquidity Incentives](https://fiftycentdollars.substack.com/p/kalshis-new-liquidity-incentives)
- [Blondie Predicts: Unpacking Kalshi's Incentives](https://blondiepredicts.substack.com/p/unpacking-kalshis-incentive-programs)
- [Sportico: Kalshi RFQ Parlays](https://www.sportico.com/business/sports-betting/2025/kalshi-parlay-combo-rfq-explainer-1234877038/)
- [WEEX: Polymarket LP Cost Traps](https://www.weex.com/news/detail/four-key-truths-and-cost-traps-behind-polymarket-lp-market-making-incentives-400664)
- [Finance Magnates: Prediction Markets Scale Up](https://www.financemagnates.com/fintech/prediction-markets-scale-up-as-volumes-surge-but-regulation-and-liquidity-remain-key-constraints/)
- [Axios: Kalshi-AP Elections Data Deal](https://www.axios.com/2026/03/02/kalshi-ap-elections-data)
- [CF Benchmarks: Kalshi Crypto](https://www.cfbenchmarks.com/blog/kalshi-leads-surging-crypto-event-contract-market-powered-by-cf-benchmarks)
- [STATSCORE-Kalshi Partnership](https://www.statscore.com/news-center/statscore-news/statscore-and-kalshi-forge-strategic-three-year-partnership-to-elevate-sports-trading/)
- [Polymarket + Chainlink Partnership](https://www.prnewswire.com/news-releases/polymarket-partners-with-chainlink-to-enhance-accuracy-of-prediction-market-resolutions-302555123.html)
- [UMA MOOV2 Whitelist Update](https://blog.uma.xyz/articles/managed-proposers-update)
- [MLB-Polymarket Deal (ESPN)](https://www.espn.com/mlb/story/_/id/48248176/mlb-reaches-agreements-polymarket-federal-commission)
- [Sportico: NHL Data via Sportradar](https://www.sportico.com/business/sports-betting/2025/nhl-kalshi-polymarket-data-sportradar-genius-1234874471/)
- [Finbold: Polymarket Fee Revenue](https://finbold.com/polymarket-set-to-earn-around-1-million-a-day-with-upcoming-fee-structure/)

### Data Sources
- [GitHub: Kalshi Data (40K events, 157K contracts)](https://github.com/Ismat-Samadov/kalshi_com)
- [Dune: Polymarket Activity](https://dune.com/filarm/polymarket-activity)
- [Dune: Polymarket CLOB Stats](https://dune.com/lifewillbeokay/polymarket-clob-stats)
- Polymarket Gamma API: `gamma-api.polymarket.com/events` (direct pagination, March 27, 2026)
- Kalshi API: `trading-api.kalshi.com/trade-api/v2/events` (direct pagination, March 25, 2026)
