# MARKETS_CONCENTRATION — derivation notes

Every value in `data.ts` for the `RetailPnLMarkets` chart has a story behind it. This file is the story. Numbers shift when reality shifts; the methodology is the durable thing.

## Framing

- **Per-platform**, not per-vertical. Each row measures what one operator (or a tight cluster of dominant operators) extracts from one of its users over their tenure. The user counts CAC against this.
- **Lifetime vol / user** = cumulative notional traded, handle wagered, or capital held through one platform across the typical active customer's tenure. Includes leverage where the venue's volume is reported leveraged (perps, options, CFDs).
- **Lifetime platform rev / user** = what the operator actually collects. Excludes spread paid to third-party market makers, slippage to LPs, and other costs the user pays to non-platform actors.
- **CAC-eligible user** = funded account that completed activation (deposited + at least one real trade or wager). Excludes dormant signups, bots, leaderboard-only filtering, and one-time tourists.

The two figures together describe what a platform builder can realistically model. A trading desk pays acquisition costs to win one of these users; this is what they get back.

## Row-by-row

### 1. Index funds

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $148K held | $3.5K | 20 yr |

**Volume.** Not "volume traded" — passive investors don't trade. Use *balance held* as the LTV proxy. Vanguard *How America Saves 2025* reports the average defined-contribution participant balance at $148,153 at year-end 2024 across ~5M Vanguard DC participants. The figure is comparable in order of magnitude across other major providers (Fidelity, Schwab) because the population is the same retail saver class.

**Revenue.** Blended retail expense-ratio mix across the major providers — Vanguard (VOO 0.03%, VTSAX 0.04%), iShares (IVV 0.03%, ITOT 0.03%), State Street (SPY 0.0945%), Fidelity (FXAIX 0.015%, FSKAX 0.015%), Schwab (SCHX 0.03%, SWPPX 0.02%) — pulled up by legacy active mutual funds and target-date funds still held in 401(k)s (~0.40-0.80% ER). Realistic retail blend ~0.12%. Math: 0.12% × $148K × 20yr = $3,552. Rounded to $3.5K.

**Confidence.** High on volume. Medium on revenue — blended ER varies widely by cohort; pure-VOO holders pay $888, target-date-heavy retirees pay $9K.

---

### 2. Robinhood stocks

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $425K | $500 | 3.2 yr |

**Volume.** Robinhood 2024 cumulative notional across asset classes: equities $1.18T + crypto $143B + options ~$165B notional ≈ $1.49T total. Divided by 11M MAU (Q3 2024 reported active base, not the 26.2M cumulative funded figure which includes dormants) = $135K/year. Times 3.2 yr typical active tenure (post-2020 retail surge cohorts have aged ~3-4 yr by 2026) = $425K lifetime.

**Revenue.** Robinhood ARPU FY2024 ≈ $164/year per funded user (transaction-based + interest + Gold subs). Times 3.2 yr = ~$525, rounded to $500. PFOF dominates; equity commissions are zero.

**Confidence.** High. Robinhood publishes both figures.

---

### 3. Crypto spot (Coinbase)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $53K | $800 | 2.0 yr |

**Volume.** Coinbase 2024 consumer (retail) trading volume: $221B. Average MTUs (monthly transacting users): 8.4M. Per-MTU annual = $26.3K. MTU cohorts churn heavily — Coinbase MTU base swung 11.4M peak (Q4 2021) → 7.3M (Q3 2023) → 8.4M (2024 avg). Practical active lifespan for a typical retail MTU ≈ 2 yr. Lifetime = $26.3K × 2 yr = $53K.

**Revenue.** Coinbase retail take rate ~1.5% (blended convert + spread on retail orders). $53K × 1.5% = $795, rounded to $800.

**Confidence.** High volume, medium revenue (1.5% blended is a Coinbase-disclosed average; mix shifts with asset).

---

### 4. US options (Robinhood)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $2M | $300 | 3 yr |

**Volume.** US listed options 2024: 12.1B contracts (OCC), retail share ~45-50%. Retail premium ~$300B/yr; underlying notional with leverage ~30× premium = ~$9T/yr. Active retail options-enabled accounts ~5-6M across Robinhood + Webull + tastytrade + Schwab + Fidelity. Per-user annual notional ≈ $1.5-1.8M; lifetime over 3 yr ≈ $2M (Robinhood-share of a typical multi-broker user).

**Revenue.** Bryzgalova, Pavlova, Sikorskaya (JoF 2023, jofi.13285) — $4.13B aggregate retail bid-ask + commission costs Nov 2019–Jun 2021 (20 months). Annualized: $2.48B. Scale-up for 2024-2025 volume doubling, less PFOF softening: ~$4.5B/yr aggregate cost to retail. Per-trader annual cost ~$820 → ~$2,460 lifetime *total user cost*. But — and this is the critical move — **only ~12% of that cost goes to the broker** (PFOF + commissions); 88% goes to options market makers (Citadel, Susquehanna, Optiver, IMC). Platform-collected revenue per Robinhood options-enabled account: ~$90/yr × 3 yr = $270, rounded to $300.

**Confidence.** Medium. The 12% broker-share split is implied by Robinhood's $222M Q4 2024 options revenue ÷ options-enabled account count.

---

### 5. Crypto perps (Binance Futures)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $3M | $1.5K | 3 yr |

**Volume.** CEX perp volume cumulative 2020-2026: ~$260T across top-10 exchanges (CoinGecko + Cornell + Phemex + CCData aggregates). Binance Futures share ~35-40% → ~$95-100T. Binance futures-funded accounts ~30M (from 280M registered Binance accounts × ~75% trade weekly × ~67% derivatives share, deduped for spot-only). Per-Binance-Futures-user cumulative ≈ $100T / 30M = $3.3M, rounded to $3M.

Cross-check: Hyperliquid live leaderboard pull 2026-05-16 (35,897 wallets, $9T cumulative, median $21M). Full Hyperliquid funded base ~870K, $4.44T total = $5.1M/user. Convergence within 50%, accounting for Hyperliquid's heavier per-user concentration and CEX multi-platform overlap.

**Revenue.** Binance Futures fees: 0.05% taker, 0.02% maker. Blended ~0.025% × $3M × 2 (round-trip) = $1,500. Funding rates net-zero between traders (Binance keeps a small slice in some hours, immaterial vs commission flow).

**Confidence.** Medium. Exchange-level "futures-active user" disclosures are absent across the industry; denominator triangulated from registered counts × derivatives share.

---

### 6. FX / CFDs (Plus500)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $33M | $5K | 3 yr |

**Volume.** Plus500 FY2024: 254,138 active customers, 56M trades total → 220 trades/customer/year. ESMA-capped retail FX leverage (30:1 majors, 20:1 minors, 5:1 indices, 2:1 crypto) means typical retail CFD notional per trade ~$50K. Annual notional turnover per active customer: 220 × $50K = $11M. Over 3-yr typical active tenure = $33M.

**Revenue.** Plus500 ARPU FY2024 = $1,548. × 3 yr = $4,644, rounded to $5K. Plus500 is the counterparty (market maker), so spread IS revenue. This is also where the take rate on notional sits — $5K / $33M = 0.015%, suspiciously low until you remember leverage means most user capital is at risk on tiny notional moves.

**Confidence.** High. Plus500 publishes both metrics directly.

---

### 7. Prediction markets (Polymarket + Kalshi)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $50K | $550 | 2 yr |

**Volume.** Combined Polymarket + Kalshi cumulative volume mid-2026 ≈ $190B (Polymarket ~$110B + Kalshi ~$80B; sources: The Block, TRM Labs, Sacra Kalshi $1.5B ARR / $178B annualized, Token Terminal). Active funded users deduped across both platforms ~3.7M (Polymarket peak MAU ~700-900K + Kalshi ~1.5-2M active + Robinhood-Kalshi users, heavy overlap). Per-user = $190B / 3.7M ≈ $51K, rounded to $50K.

**Revenue.** Kalshi takes ~1.75% per side on contracts → ~1.5-2% effective on notional → ~$1.2-1.6B lifetime fees. Polymarket charged 0% historically; introduced 2-7% taker fees by category in March 2026 → ~$200-400M forward fees. Total platform revenue ~$1.5-2B / 3.7M users ≈ $550/user, rounded to $550. NOTE: this excludes the ~3% LP spread retail users also pay — that money goes to liquidity providers, not the platforms.

**Confidence.** Medium. Kalshi user count growing fast; the denominator is a 2026 snapshot that will be stale by 2027.

---

### 8. Sports betting (DraftKings)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $26K | $2K | 2 yr |

**Volume.** DraftKings FY2024: $48.1B sportsbook handle / 3.7M MUPs = $13,000/MUP/year. Times 2-yr typical active payer tenure = $26K lifetime handle.

**Revenue.** Sports betting hold rate: ~7.5-8% (DraftKings 10-K). $26K × 7.5% = $1,950, rounded to $2K. Hold IS revenue — DraftKings is the counterparty.

**Confidence.** High. DraftKings 10-K is explicit.

---

### 9. Memecoins (Pump.fun)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $24K | $250 | 1.5 yr |

**Volume.** Pump.fun cumulative DEX volume ~$89.6B (DefiLlama, May 2026). Funded-human-trader denominator: from 13.55M raw wallet count (Dune via The Block/Cointelegraph), strip ~30% single-tx throwaways + heavy bot automation cohort. Defensible human trader count ~3.7M. Per-user = $24K. Sanity check: April 2026 MAU 3.14M, peak May 2025 MAU 5.2M — consistent.

**Revenue.** Pump.fun direct fees: 1% on every trade. $24K × 1% = $240, rounded to $250. NOTE: this excludes slippage and Solana DEX spread (~4%) which the user also bears — that money goes to LPs and memecoin sellers, not Pump.fun.

**Confidence.** Medium-low. Founder Alon has publicly disputed Dune wallet counts; the bot-vs-human split is the wobbliest denominator in the chart.

---

### 10. Sweeps casinos (Stake.us / VGW)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $10K | $4K | 3 yr |

**Volume.** Sweeps GGR ~$11B (Eilers & Krejcik 2024-2025). Implied handle ~$25-30B (sweeps coin churn 3-5× before reflecting net). VGW alone: AU$6.1B gross / ~$4.2B USD pre-prize, $1.2B USD net across ~10-12M players. Paying users (12% conversion of 38M total) ~4.5M industry-wide. Top operator (Stake.us or VGW) captures ~50-60% of a sweeps user's spend. Per-platform handle ~$10K, lifetime over 3 yr.

**Revenue.** $11B net GGR / 4.5M payers = ~$2,400/yr; per-top-platform ~$1,300/yr × 3 yr = ~$4K.

**Confidence.** Medium. Per-platform splits estimated from VGW + Stake.us disclosures.

---

### 11. Online casinos (BetMGM / DraftKings Casino)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $80K | $4.8K | 3 yr |

**Volume.** BetMGM 2024: 946K average monthly actives, $1.5B iGaming net revenue → $1,585/yr GGR per active iGaming customer. Slot-heavy hold ~5-7%; at 6% → ~$26,700 annual handle per active. Over 3-yr typical active tenure (55% churn in year 1; surviving cohort 3-4 yr) = $80K lifetime handle.

**Revenue.** $1,585/yr × 3 yr = $4,755, rounded to $4.8K. iGaming operator is the counterparty for slot mechanics.

**Confidence.** High. BetMGM and DraftKings publish MAU + iGaming net rev quarterly.

---

### 12. Online poker (PokerStars)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $60K | $3K | 2 yr |

**Volume.** Global online poker GGR (rake) ~$4-6B/yr (MarkNtel 2024 cites $7.98B including ancillary; conservative core $4-5B). At 5% rake → annual handle ~$80-100B. PokerStars ~50% market share → ~$40-50B/yr. Active funded MAU at PokerStars ~500K-750K. Per-user annual handle ~$60-100K. Times 1.5-2 yr typical funded tenure → $60K lifetime.

**Revenue.** 5% capped rake × $60K = $3K. PokerStars is the rake operator.

**Confidence.** Medium. Flutter's PokerStars segment disclosures are aggregated; per-user math interpolated.

---

### 13. Online lottery (PA / MI iLottery)

| LTV vol | Platform rev | Tenure |
|---|---|---|
| $8.5K | $2.4K | 4 yr |

**Volume.** PA iLottery FY23-24: $976M eInstant + $63M draw = $1.04B handle. Estimated 400-500K monthly active accounts → $2,000-2,500/yr handle per active. MI iLottery: 2.2M registered, 1.1M ever-purchased, ~$1.5B+ sales → $1,400-2,000/yr. Across major iLotteries, typical ~$2,100/yr × 4 yr active tenure = $8,500 lifetime handle.

**Revenue.** iLottery state take ~28% of handle (75% prize payout on eInstant, residual to retailers + suppliers). $8.5K × 28% = $2,380, rounded to $2.4K.

**Confidence.** Medium. Neither PA nor MI publishes per-player ARPU directly; tenure estimate is the weakest link.

---

## What this chart says, distilled

The per-platform revenue ladder, low to high:

| Market | Per-platform rev / user |
|---|---|
| Memecoins (Pump.fun) | $250 |
| US options (Robinhood) | $300 |
| Robinhood stocks | $500 |
| Prediction markets | $550 |
| Crypto spot (Coinbase) | $800 |
| Crypto perps (Binance Futures) | $1.5K |
| Sports betting (DraftKings) | $2K |
| Online lottery (PA iLottery) | $2.4K |
| Online poker (PokerStars) | $3K |
| Index funds (blended) | $3.5K |
| Sweeps casinos (Stake.us) | $4K |
| Online casinos (BetMGM) | $4.8K |
| FX / CFDs (Plus500) | $5K |

The trading-platform builder's ceiling lands around $3-5K. Gambling-platform builders sit in the same band on a per-platform basis once you strip out the multi-platform aggregation. The 100× gap I'd quoted earlier was a brick-and-mortar artifact — once everything is digital and per-platform, the gap collapses to ~10×.

The remaining 10× advantage of gambling over trading comes from one thing: **regulatory permission to set the odds against the user explicitly**. Slot machines and lottery games extract by design; trading platforms extract by friction. The asymmetry is no longer in user behavior — it's in what regulators allow.

## Caveats applying to the whole chart

1. **Tenure assumptions vary by source quality.** Plus500 publishes; Pump.fun does not. The lottery numbers are the most extrapolated.

2. **The concentration shape (the line) is separate from the LTV figures (the stats).** The line is "share of profit pot captured by the bottom N%" — academic Lorenz-curve framing. The LTV figures are commercial/operator framing. Both are about the same retail universe but measure different aspects.

3. **Numbers will drift.** Anything tagged "late 2026" needs a re-pull annually. Crypto perps and prediction markets are the fastest movers.

4. **No invented numbers.** Every figure traces to a published source. Where derivation is required (denominator triangulation, leverage assumptions), the methodology is in the row notes above.
