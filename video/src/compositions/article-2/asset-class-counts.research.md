# Tradeable Markets by Asset Class — Count Research

Research for a data-visualization video ranking asset classes by *how many distinct tradeable markets exist*. Numbers are as of 2025–2026 with defensible public sources. Where a figure is genuinely uncertain or definition-dependent, a range is given and the ambiguity is flagged.

**The central caveat:** "how many markets" depends entirely on what you count. A single underlying stock spawns thousands of option series. A single NFL game spawns hundreds of betting markets. "Crypto tokens" can mean ~10,000 curated listings or 50,000,000+ tokens ever minted. The table below states the *definition* for every row so the chart counts apples against apples.

---

## Master Table

| # | Category | Best single number | Low–high range | What's being counted (definition) | Source (publisher, date) | Outlier? |
|---|----------|--------------------|----------------|-----------------------------------|---------------------------|----------|
| 1 | **Forex / currency pairs** | **~28** commonly quoted; up to **~70** broker-offered | 7 (majors) → ~70 (full broker menu) | Distinct currency pairs commonly quoted: 7 majors + ~20–25 minors/crosses + a tail of exotics. Brokers typically list up to ~70. | BabyPips, Kinesis, Equiti (forex education, 2025) | No |
| 2 | **Commodities (distinct)** | **~30–40** | ~15 (headline) → ~100+ (all listed futures incl. variants) | Distinct physical commodities with liquid futures: energy, metals, agriculture, livestock. Most lists settle around 30–40; "top traded" lists show ~10–15. | Wikipedia *List of traded commodities*; StockLists commodities list (2025) | No |
| 3 | **Global listed stocks** | **~50,000** | ~49,000 → ~58,000 | All exchange-listed companies worldwide (WFE member + feeding exchanges). | World Federation of Exchanges, FY2024 Market Highlights (Feb 2025) | No |
| 4 | **US listed stocks** | **~5,200** | ~5,000 → ~5,700 | Operating companies listed on NYSE + Nasdaq (domestic + foreign). | Statista / U. of Florida (Ritter) listed-firms dataset (2025) | No |
| 5 | **OTC / micro-cap / penny stocks** | **~12,000** | ~11,500 → ~12,400 | Securities quoted on OTC Markets Group (OTCQX, OTCQB, Pink/OTCID), US + international. | OTC Markets Group / Wikipedia (early 2025) | No |
| 6 | **ETFs / ETPs** | **~15,600** global; **~4,000+** US | global ~15,000 → ~15,700; US ~3,500–4,000 | Distinct exchange-traded products listed worldwide (>30,000 listings across 83 exchanges). | ETFGI press release (end Nov 2025) | No |
| 7 | **Crypto — actively tracked/listed** | **~13,000** | CoinMarketCap ~10,700 active → CoinGecko ~17,400 tracked | Curated cryptocurrencies with verified market data on the major aggregators. | CoinGecko (2025), CoinMarketCap (June 2025) | No |
| 8 | **Memecoins — pump.fun launched** | **~10,000,000+** total launched | 6M (Jan 2025) → 10M+ (mid/late 2025) | Tokens ever minted on pump.fun. "Live"/graduated to a DEX is **~1%** (graduation rate 0.4–1.8%), i.e. on the order of tens of thousands graduated all-time. | pump.fun / Wikipedia; MEXC, Cryptopolitan graduation data (2025–2026) | **YES (huge)** |
| 9 | **Prediction markets (Polymarket + Kalshi)** | **~85,000+** active (Polymarket); combined well into six figures over a year | Polymarket: ~7,000 new/month (Apr 2025) to 38,270 new in Oct 2025; ~85,000+ active at peak | Distinct event-contract markets. Polymarket reports 85,000+ active markets; both platforms create tens of thousands of new markets per month. Kalshi total count not publicly fixed. | Wikipedia *Polymarket*; KuCoin/Phemex prediction-market guides (2025–2026) | Borderline |
| 10 | **Sports betting markets** | **~hundreds per game** (order: 10²–10³) | ~100 → ~1,000+ per single major event | Distinct markets a major sportsbook offers on one event (moneyline, spread, totals, hundreds of player props, same-game-parlay legs). Across a full day × all sports the total runs into the tens of thousands. | DraftKings/FanDuel/BetMGM; FOX Sports, SI prop-betting guides (2026) | **YES (huge in aggregate)** |
| 11 | **US listed options series** | **~1,000,000+** | ~1,000,000 → several million live series | Distinct option series (each strike × expiration × call/put). ~4,000–4,500 underlyings × many strikes × many expirations. Open interest ended 2025 at 552M contracts; 15.2B contracts traded in 2025. | Citadel Securities ("over a million options series"); OCC/Cboe State of the Options Industry (2025) | **YES (huge)** |
| 12 | **Bonds / fixed income** | **tens of millions** of distinct securities | Municipal alone >1,000,000 CUSIPs; corporate issue detail >140,000; total fixed income across all types runs into the tens of millions of CUSIPs | Distinct fixed-income securities by CUSIP. US muni market alone is >1M outstanding CUSIPs; add Treasuries, corporates, agencies, MBS, sovereigns globally. | MSRB (muni "over one million" CUSIPs); SIFMA fixed-income outstanding; Mergent FISD (2024–2025) | **YES (huge)** |

---

## Per-category notes

**1. Forex.** The clean, recognizable number is the canonical 28 pairs that come from the 8 major currencies (7 USD-majors + the crosses). Education sources are unanimous on 7 major pairs; "majors + minors + exotics commonly quoted" lands near 28; the widest defensible number is the ~70 a broker will list. Use **~28** for a retail-recognizable count.

**2. Commodities.** There is no single authority. Wikipedia's *List of traded commodities* and broker "complete commodities" lists cluster around **30–40 distinct commodities** with liquid futures. Headline "most-traded" lists show 10–15. If you count every listed futures contract variant (grades, delivery months as separate contracts), the number balloons, but that double-counts the same underlying. Use **~30** as the honest "distinct commodities" figure.

**3. Global listed stocks.** WFE is the gold standard. End-2024 figures reported between **~49,054 and ~51,000+** depending on the cut; earlier WFE reports including all feeding exchanges have shown up to ~58,000. Use **~50,000**.

**4. US listed stocks.** NYSE + Nasdaq operating companies: roughly **3,450 Nasdaq + 2,200 NYSE ≈ 5,650**, or ~5,172 counting domestic+foreign operating firms (end-2025). Use **~5,200**. (This is the famous "US listed company count has halved since the 1990s" universe.)

**5. OTC / micro-cap.** OTC Markets Group consistently reports **~12,000–12,400 securities** across its tiers. This is the cleanest "penny stock / micro-cap" proxy. Use **~12,000**.

**6. ETFs/ETPs.** ETFGI (the industry's standard data house) reported **15,610 products** end of November 2025, >30,000 listings. US is the largest single market at roughly 3,500–4,000 funds. Use **global ~15,600 / US ~4,000**.

**7. Crypto — tracked/listed.** Two defensible curated numbers: **CoinMarketCap ~10,700 active** (June 2025) and **CoinGecko ~17,400 tracked / ~16,357 in market-cap calc**. These are the "tradeable, has-a-real-market" universe. Use **~13,000** as a midpoint, or cite both. Do **not** use this row for the tens-of-millions figure — that's category 8 territory.

**8. Memecoins (pump.fun).** Total ever launched crossed **6,000,000 by Jan 2025** and **10,000,000+** by mid/late 2025. The "live"/graduated count is tiny: graduation rate runs **0.4%–1.8%**, so genuinely live tokens are on the order of tens of thousands all-time. For scale, broader DEX scanners (CoinMarketCap DexScan, etc.) track **28M–51M tokens** created across all chains. This is the single most explosive number in the set and the cleanest "the long tail is insane" story-beat. **Flag as a huge outlier.**

**9. Prediction markets.** Polymarket reports **85,000+ active markets** at peak and created **38,270 new markets in October 2025 alone**; April 2025 saw 7,000+ new in a month. Kalshi does not publish a clean total-markets count (it's CFTC-regulated and reports volume — $238B in 2025 — rather than market count). Combined, the two create well into six figures of distinct markets per year. For a single-day "active markets" snapshot, **~85,000+ (Polymarket)** is the most citable hard number. Treat as borderline-large but chart-able.

**10. Sports betting.** No clean total exists, and it's definition-dependent. The defensible, repeatable claim: a major sportsbook offers **hundreds of distinct markets on a single game** (moneyline, spread, totals, and hundreds of player props + same-game-parlay legs). Across all sports on a busy day this is tens of thousands of live markets. Order of magnitude: **10²–10³ per event**. **Flag as a huge aggregate outlier** — it doesn't have a single canonical number.

**11. Options.** Citadel Securities states it makes markets in **"over a million options series."** Each of ~4,000–4,500 optionable underlyings carries dozens of strikes across many expirations (weeklies, monthlies, LEAPS, 0DTE), so the live series count is **1,000,000+** and arguably several million. 15.2 billion contracts traded in 2025; open interest 552M. **Flag as a huge outlier** — this breaks any linear axis.

**12. Bonds / fixed income.** The largest of all by instrument count. US municipal bonds alone exceed **1,000,000 outstanding CUSIPs** (MSRB). Add US Treasuries, ~140,000+ corporate issues (Mergent FISD), agencies, MBS, and the global sovereign/corporate universe, and the distinct-security count runs into the **tens of millions** of CUSIPs. Dollar size: ~$49.6T US fixed income outstanding (SIFMA). **Flag as the biggest outlier.**

---

## Recommendation — the cleanest ranked story

For a general/retail audience, the spine of the chart should be the categories a retail trader instantly recognizes, ranked smallest → largest. The story writes itself: *the markets you know are tiny; the markets you don't are oceans.*

**Recommended 9-category ranked set (smallest → largest):**

1. **Forex pairs** — ~28
2. **Commodities** — ~30
3. **US listed stocks** — ~5,200
4. **OTC / micro-caps** — ~12,000
5. **Crypto (listed/tracked)** — ~13,000
6. **ETFs (global)** — ~15,600
7. **Global listed stocks** — ~50,000
8. **Prediction markets (Polymarket active)** — ~85,000
9. **Memecoins launched (pump.fun)** — ~10,000,000+

This set is internally honest: every row is a *count of distinct tradeable things*, all sourced, and it climbs cleanly across **six orders of magnitude** — from ~10¹ (forex) to ~10⁷ (memecoins).

**Optional 10th beat — the "off the chart" reveal.** Drop in **options (~1,000,000+ series)** and **bonds (tens of millions)** as a deliberate "and these don't even fit on the screen" moment. They sit *above* memecoins-launched on instrument count and make the strongest punchline: even the memecoin firehose is dwarfed by the bond market's CUSIP count. Sports betting (hundreds per game → tens of thousands per day) belongs in the same "doesn't have one clean number, but it's enormous" bucket.

### Orders-of-magnitude spread (for axis choice)

| Smallest | → | Largest |
|----------|---|---------|
| Forex ~28 (10¹·⁵) | | Bonds ~10⁷–10⁸ |

The clean retail set spans **~28 → ~10,000,000**, which is **~5.5 to 6 orders of magnitude**. Add options/bonds and you reach **~7–8 orders of magnitude**.

**Therefore:**

- **Use a log axis.** A linear axis is impossible: forex (28) and global stocks (50,000) would both be invisible pixels next to memecoins (10M+). Six orders of magnitude on a linear scale collapses everything below the top two bars to zero height.
- If you want a linear axis for emotional impact, **split into two charts**: one linear "markets you recognize" chart (forex → global stocks, ~28 → 50,000), then a separate "the long tail" reveal where memecoins/options/bonds blow past the frame. The jump *between* the two charts becomes the story.
- The three genuine axis-breakers to call out explicitly as "off the chart": **options (~1M+ series), bonds (tens of millions of CUSIPs), and sports betting (no single number, hundreds per game)**. Memecoins-launched (10M+) is the fourth, and the most viral because retail recognizes pump.fun.

---

## Sources

- Forex pairs — [BabyPips: Buying & Selling Currency Pairs](https://www.babypips.com/learn/forex/buying-selling-currency-pairs); [Kinesis: Major, Minor and Exotic Currency Pairs](https://kinesis.money/blog/major-minor-and-exotic-currency-pairs-guide/); [Equiti currency pairs guide](https://www.equiti.com/sc-en/education/trading-101/major-minor-and-exotic-currency-pairs/)
- Commodities — [Wikipedia: List of traded commodities](https://en.wikipedia.org/wiki/List_of_traded_commodities); [StockLists complete commodities list](https://stocklists.co/lists/commodities)
- Global listed stocks — [WFE FY2024 Market Highlights (PDF)](https://wfe-live.lon1.cdn.digitaloceanspaces.com/org_focus/storage/media/Cally%20Billimore/WFE%20FY%202024%20Market%20Highlights%20Report%2010022025.pdf); [WFE 2025 growth release](https://www.world-exchanges.org/news/articles/new-wfe-data-public-markets-post-strong-growth-2025-despite-geopolitical-instability)
- US listed stocks — [Statista NYSE/Nasdaq listed companies](https://www.statista.com/statistics/1277216/nyse-nasdaq-comparison-number-listed-companies/); [U. of Florida (Ritter) US-listed-firms dataset](https://site.warrington.ufl.edu/ritter/files/number-of-listed-firms-on-US-exchanges.pdf)
- OTC / micro-cap — [Wikipedia: OTC Markets Group](https://en.wikipedia.org/wiki/OTC_Markets_Group); [OTC Markets: Introducing OTCID](https://blog.otcmarkets.com/2024/10/14/the-evolution-of-the-otc-market-introducing-otcid/)
- ETFs — [ETFGI: record 2,759 new products end Nov 2025](https://etfgi.com/news/press-releases/2025/12/etfgi-reports-global-etfs-industry-had-record-2759-new-products-listed)
- Crypto tracked — [CoinGecko](https://www.coingecko.com/); [CoinMarketCap: Cryptocurrencies Tracked](https://coinmarketcap.com/charts/number-of-cryptocurrencies-tracked/)
- Memecoins (pump.fun) — [Wikipedia: pump.fun](https://en.wikipedia.org/wiki/Pump.fun); [MEXC: pump.fun graduation rate](https://www.mexc.com/news/586607); [Cryptopolitan: graduations six-month high](https://www.cryptopolitan.com/pump-fun-token-graduations-six-month-high/)
- Prediction markets — [Wikipedia: Polymarket](https://en.wikipedia.org/wiki/Polymarket); [Phemex prediction markets guide](https://phemex.com/academy/what-are-prediction-markets); [KuCoin: Kalshi & Polymarket 97.5% share](https://www.kucoin.com/news/flash/kalshi-and-polymarket-dominate-97-5-of-prediction-market-share-in-2025)
- Sports betting — [FOX Sports best prop betting sites](https://www.foxsports.com/stories/betting/best-prop-betting-sites); [DraftKings NFL odds](https://sportsbook.draftkings.com/leagues/football/nfl)
- Options — [Citadel Securities: Options](https://www.citadelsecurities.com/what-we-do/options/); [Cboe: State of the Options Industry 2025](https://www.cboe.com/insights/posts/the-state-of-the-options-industry-2025/)
- Bonds / fixed income — [MSRB: About CUSIP Numbers ("over one million" muni CUSIPs)](https://www.msrb.org/About-CUSIP-Numbers); [SIFMA: US Fixed Income Securities Statistics](https://www.sifma.org/research/statistics/us-fixed-income-securities-statistics)

*Compiled 2026-05-26. Figures are point-in-time; crypto, memecoin, and prediction-market counts move fast and should be re-checked close to publication.*
