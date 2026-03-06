# Vision Lead Segmentation — Deep Analysis

> 187,634 leads analyzed | 109,302 unique emails | 48 lists | 28 segments identified
> Generated from full Instantly account data pull + multi-signal classification

---

## Executive Summary

| Category | Unique Emails | % of Total |
|---|---|---|
| **Vision-relevant** (crypto, trading, AI, betting, data-source verticals) | **55,802** | **51%** |
| TradFi-only (no crypto/trading/data angle) | 17,539 | 16% |
| Unclassified (insufficient data to classify) | 21,405 | 20% |
| Overlap / duplicates across lists | ~14,556 | 13% |

**Your lists are 51% usable for Vision.** The other 49% are either TradFi-only (save for Index/ITP) or unclassified (need manual enrichment or discard).

---

## The 28 Segments

### TIER 1: CRYPTO-NATIVE (direct Vision fit)

These leads already understand crypto, on-chain, prediction markets. Lowest friction to convert.

---

#### S01 — Crypto Traders & Quants
**Count**: 3,528 leads
**What they are**: People at crypto companies who also have trading/quant in their profile — algorithmic traders, market makers, systematic funds operating in crypto
**Why Vision**: They're your #1 user persona. Sealed parimutuel + 25K markets + Python scripting = exactly what they want. They already run bots on Polymarket and hit the "solved market" wall.
**Vision data sources that match**: ALL 79 — they trade everything
**Offer**: Working Python bot template with backtest on Vision data. Fork tonight.
**Friction**: Zero — they get it immediately

#### S02 — Crypto Protocol & Infrastructure Teams
**Count**: 4,653 leads
**What they are**: Teams building DeFi protocols, oracles, bridges, rollups, validators. Builders.
**Why Vision**: Integration partners. They can embed Vision markets into their products, use Vision as a data feed, or build on top of the batch/pool system.
**Vision data sources that match**: DefiLlama (TVL feeds for their protocols), CoinGecko (token price feeds)
**Offer**: Open API + custom endpoint for their protocol. "We'll build a data source for your TVL/token if you embed our markets."
**Friction**: Low — they understand on-chain infra

#### S03 — Crypto VCs
**Count**: 2,152 leads
**What they are**: Venture funds investing in crypto/web3 startups
**Why Vision**: Strategic investment + portfolio company distribution. One VC deal can get Vision into 20 portfolio companies.
**Vision data sources that match**: VC_INVESTOR tag means they track deals — but for Vision, the pitch is portfolio-level: "your portfolio companies can integrate Vision markets"
**Offer**: Alpha access + "help us shape the product roadmap" narrative. VCs love being early.
**Friction**: Medium — they need conviction on market size

#### S04 — Crypto Exchanges & Custody
**Count**: 2,749 leads
**What they are**: Centralized and decentralized exchanges, custody providers, OTC desks
**Why Vision**: Listing partnership. An exchange integrating Vision markets gives instant distribution. OTC desks can provide liquidity.
**Vision data sources that match**: CoinGecko, Polymarket, Bitcoin on-chain
**Offer**: "White-label prediction markets for your users. We provide the infra, you provide the distribution."
**Friction**: Medium-high — exchange listing is a slow process

#### S05 — Crypto × AI/Data
**Count**: 3,450 leads
**What they are**: AI/ML teams building in crypto — AI trading bots, sentiment analysis, on-chain analytics
**Why Vision**: They're building the exact tools that thrive on Vision. 8,640 data points/month vs Polymarket's 4. Low competition = easier to train models.
**Vision data sources that match**: ALL 79 — the more data sources, the more features for their models
**Offer**: "Your AI trains on 4 data points/month on Polymarket. On Vision: 8,640. Here's the API key + a sample training dataset."
**Friction**: Zero — they'll evaluate based on data quality

#### S06 — Crypto Media & Research
**Count**: 4,295 leads
**What they are**: Crypto journalists, newsletter writers, analysts, researchers
**Why Vision**: Content creation + awareness. "Bet on ISS altitude with 4 people" is a headline that writes itself.
**Vision data sources that match**: ALL — every weird data source is a story angle
**Offer**: Funded account + exclusive data for their next piece
**Friction**: Low — they need content, Vision IS content

#### S07 — Crypto Fintech / Payments
**Count**: 4,466 leads
**What they are**: Crypto payment processors, neobanks, lending platforms, wallets
**Why Vision**: Wallet integration. If a wallet embeds Vision, every user can bet from within the wallet. Payment rails = deposits.
**Vision data sources that match**: CoinGecko, Bitcoin on-chain, DefiLlama
**Offer**: "Embed prediction markets in your wallet/app. Our SDK handles everything."
**Friction**: Medium — product integration requires dev resources

#### S08 — Crypto Compliance & RegTech
**Count**: 2,948 leads
**What they are**: KYC/AML providers, compliance platforms, regulatory tech for crypto
**Why Vision**: Not direct users, but necessary partners. As Vision scales, compliance partnerships de-risk the regulatory narrative.
**Vision data sources that match**: SEC Filings, Congress Votes, Federal Courts
**Offer**: "We need a compliance partner. Let's build the regulatory framework together."
**Friction**: High — compliance is slow, but strategically important

#### S09 — Pure Crypto (unspecified role)
**Count**: 8,368 leads
**What they are**: Crypto people whose profiles don't reveal a specific sub-vertical. General crypto audience.
**Why Vision**: Broad awareness. Some will self-select into trading, some into building.
**Vision data sources that match**: CoinGecko, Polymarket, DefiLlama
**Offer**: Generic "25K markets, 19 avg traders per market" pitch
**Friction**: Medium — they need to find their own use case

---

### TIER 2: TRADING & DATA (adjacent, high conversion potential)

---

#### S10 — Quant Traders (Non-Crypto)
**Count**: 6,510 leads
**What they are**: Algorithmic traders, prop desks, systematic funds — but in TradFi, not crypto. Forex, derivatives, futures.
**Why Vision**: They understand the math (parimutuel, side matching, EV). They just need to know Vision exists and runs on Arbitrum. Many are crypto-curious but haven't found the right product.
**Vision data sources that match**: Finnhub Stocks, FRED Rates, Treasury Yields, CFTC Commitments, Futures, FINRA Short Interest
**Offer**: "Same sealed parimutuel model you understand, but across 25K markets including CFTC positioning, Treasury yields, FINRA shorts. Python scripting built in."
**Friction**: Medium — crypto onboarding (wallet, USDC) is the main barrier

#### S11 — AI/Data Science (Non-Crypto)
**Count**: 5,828 leads
**What they are**: ML engineers, data scientists, analytics teams — NOT in crypto
**Why Vision**: 79 data sources = 79 feature sets for their models. Vision is a live, monetizable prediction playground.
**Vision data sources that match**: ALL — especially npm, PyPI, GitHub (tech people), NOAA, OpenMeteo (data nerds)
**Offer**: "We have live prediction markets on npm downloads, earthquake magnitudes, and 77 other data sources. Your ML models can trade them for real money."
**Friction**: Medium-high — need crypto education + wallet setup

#### S12 — Hedge Funds
**Count**: 4,670 leads
**What they are**: Traditional hedge fund managers — long/short, macro, multi-strategy
**Why Vision**: Alpha generation via alternative data. Vision's 79 sources include data they can't get elsewhere (4chan, anime, weather stations, transit data).
**Vision data sources that match**: FRED, Treasury, CFTC, SEC 13F, FINRA, Futures, EIA Energy, OPEC, ECB
**Offer**: "Alternative data alpha. 25K prediction markets on data most quant desks don't model yet. Python API + backtest."
**Friction**: High — institutional due diligence, crypto skepticism. Worth it for one converted fund.

---

### TIER 3: INDUSTRY VERTICALS (matched to Vision data sources)

This is the unique play. Nobody else has these segments because nobody else has 79 data sources.

---

#### S13 — Betting & Gaming (Combined)
**Count**: 3,611 leads
**What they are**: Sports betting companies, iGaming platforms, esports orgs, gaming studios
**Why Vision**: They UNDERSTAND parimutuel, sealed bets, odds. Vision's model is their native language. Esports markets (PandaScore), sports data, and gaming data (Steam, Twitch) are already live on Vision.
**Vision data sources that match**: Sports Stats, Esports (PandaScore), Steam Gaming, Twitch Streaming
**Offer**: "Sealed parimutuel betting across 25K markets — crypto, esports, weather, anime. Same model your users understand. White-label or integration."
**Friction**: Low — they get the model instantly

#### S14 — Sports Betting (subset)
**Count**: 1,833 leads
**Specific offer**: "Your users already bet on NFL, NBA. On Vision they can bet on earthquake magnitudes, anime ratings, ISS altitude. Same pari-mutuel model, exotic markets nobody else offers."

#### S15 — Gaming & Esports (subset)
**Count**: 2,728 leads
**Specific offer**: "Live prediction markets on Steam concurrent players, Twitch viewer counts, esports match results. Your community's knowledge IS the edge."

#### S16 — Biotech & Health
**Count**: 10,716 leads
**What they are**: Biotech companies, pharma, clinical trial platforms, medical device, genomics
**Why Vision**: PubMed (24 research areas), OpenAlex (25 academic fields), Crossref citations — all are live markets on Vision. Biotech analysts who track publication trends can now TRADE that knowledge.
**Vision data sources that match**: PubMed Medical, OpenAlex Papers, Crossref Citations
**Offer**: "Your knowledge of clinical trial publications and research trends is now tradeable. PubMed publication counts are live markets on Vision — 6 traders per market."
**Friction**: High — most won't care about prediction markets. But 1% conversion of 10K = 100 niche experts who dominate these markets.

#### S17 — Energy & Commodities
**Count**: 6,261 leads
**What they are**: Oil & gas, mining, renewable energy, carbon markets, commodity traders
**Why Vision**: EIA Energy, OPEC Oil, CFTC Commitments, NRC Nuclear — all live markets. These people model energy data daily.
**Vision data sources that match**: EIA Energy, OPEC Oil Data, CFTC Commitments, NRC Nuclear, Wildfire Tracking
**Offer**: "You model EIA data anyway. Now that analysis pays. Live prediction markets on crude oil inventories, nuclear reactor output, wildfire intensity. 12 traders per market."
**Friction**: Medium — they understand data-driven trading, just not crypto

#### S18 — Space & Defense
**Count**: 5,448 leads
**What they are**: Aerospace companies, satellite operators, defense contractors, military tech
**Why Vision**: ISS Tracker, Space Weather, Military Aircraft — all live markets. These are ultra-niche, zero-competition markets.
**Vision data sources that match**: Space Weather, ISS Tracker, Military Aircraft
**Offer**: "We have live prediction markets on ISS orbital altitude, solar flare intensity, and military aircraft activity. 4 traders per market. Your clearance-level domain knowledge is untradeable alpha."
**Friction**: High — institutional, regulated, probably can't gamble. But the NEWSLETTER writers in this space can amplify.

#### S19 — Weather & Climate
**Count**: 1,103 leads
**What they are**: Weather companies, climate tech, meteorology services
**Why Vision**: NOAA Weather, Open-Meteo, Air Quality, USGS Water, River Gauges, Ocean Buoys, Tides — 13+ geophysical data sources are live markets.
**Vision data sources that match**: NOAA Weather, Weather Alerts, Open-Meteo, Air Quality, USGS Water, NOAA Ocean Met, NOAA Tides, NDBC Ocean Buoys, River Gauges, NRC Nuclear, Wildfire Tracking, Disease Tracking
**Offer**: "You check NOAA daily. Now it pays. Prediction markets on weather station data, river discharge, ocean buoy readings. You know more about these patterns than any Wall Street quant."
**Friction**: Medium — they're data people, they'll evaluate on accuracy

---

### TIER 4: TRADFI SEGMENTS (Vision-adjacent, secondary)

These won't convert to Vision traders in alpha, but subsets are usable.

---

#### S20 — Traditional Asset Managers
**Count**: 29,791 leads (largest segment)
**Vision fit**: Very low as traders. BUT: some use alternative data for alpha signals. The subset that uses alt data could consume Vision's data feeds even without trading.
**Salvage play**: Pitch the DATA, not the product. "79 real-time alternative data feeds via API — weather, transport, social sentiment, academic output. For your alpha models."
**Action**: Do NOT email all 29K about Vision. Cherry-pick the alt-data subset.

#### S21 — ETF & Index Products
**Count**: 973 leads
**Vision fit**: Zero for Vision. These are Index/ITP product leads. Keep for your other product.

#### S22 — Real Estate
**Count**: 10,031 leads
**Vision fit**: Low BUT — Zillow housing data is a live market on Vision. Real estate analysts tracking housing indices could trade these.
**Vision data sources that match**: Zillow Real Estate
**Salvage play**: Small pilot — "Zillow home value index is now a live prediction market. You track housing data anyway."

#### S23 — Insurance
**Count**: 5,109 leads
**Vision fit**: Low BUT — insurance is fundamentally about predicting risk. Weather markets (NOAA), disease tracking, wildfire data, earthquake data = all relevant to actuarial models.
**Vision data sources that match**: NOAA Weather, Earthquake, Wildfire, Disease Tracking
**Salvage play**: "Your actuarial models predict catastrophic events. Vision has live prediction markets on earthquakes, wildfires, and disease spread. Test your models in real-time."

#### S24 — VCs (Non-Crypto)
**Count**: 5,780 leads
**Vision fit**: Low as users, but potential as investors if Vision raises.

#### S25 — Media (Non-Crypto)
**Count**: 15,877 leads
**Vision fit**: Content creators, journalists, analysts who DON'T cover crypto. Vision's weird markets (ISS altitude, anime ratings, nuclear reactor output) are novelty stories even for non-crypto media.
**Offer**: "Prediction market where you can bet on earthquake magnitudes and anime ratings. Story pitch, not sales pitch."

#### S26 — Payments (Non-Crypto)
**Count**: 15,237 leads
**Vision fit**: Low. These are TradFi payment companies. Unless they're building crypto rails.

#### S28 — Compliance (Non-Crypto)
**Count**: 6,861 leads
**Vision fit**: Zero for alpha. Maybe later for regulatory partnerships.

---

## VISION DATA SOURCE × SEGMENT MATRIX

This is the unique part. Each of Vision's 79 data sources maps to a natural community that ALREADY monitors this data.

| Vision Source | Natural Community | Segment | Est. Leads |
|---|---|---|---|
| **CoinGecko Crypto** | Crypto traders | S01, S09 | ~11,896 |
| **Pump.fun Tokens** | Degen traders, CT | S01, S09 | ~11,896 |
| **DefiLlama DeFi** | DeFi protocol teams | S02 | ~4,653 |
| **Finnhub Stocks** | Quant traders | S10, S12 | ~11,180 |
| **Polymarket** | Prediction market traders | S01, S09 | ~11,896 |
| **FINRA Short Interest** | Short sellers, hedge funds | S12, S10 | ~11,180 |
| **Futures** | Commodity traders | S10, S17 | ~12,771 |
| **Bitcoin On-Chain** | Crypto analysts | S01, S05 | ~6,978 |
| **FRED Interest Rates** | Macro traders | S10, S12 | ~11,180 |
| **EIA Energy** | Energy traders | S17 | ~6,261 |
| **Treasury Yields** | Bond traders | S10, S12 | ~11,180 |
| **CFTC Commitments** | Commodity traders | S10, S17 | ~12,771 |
| **SEC Filings** | Equity analysts | S10, S12 | ~11,180 |
| **Congress Votes** | Political analysts | S25 | ~15,877 |
| **GitHub Repos** | Developers | S11, S05 | ~9,278 |
| **npm Packages** | JS developers | S11 | ~5,828 |
| **PyPI Packages** | Python developers | S11 | ~5,828 |
| **Crates.io Rust** | Rust developers | S11 | ~5,828 |
| **StackOverflow** | Developers | S11 | ~5,828 |
| **Hacker News** | Tech community | S11, S25 | ~21,705 |
| **Twitch Streaming** | Gamers, streamers | S15 | ~2,728 |
| **Steam Gaming** | Gamers | S15 | ~2,728 |
| **AniList Anime** | Anime community | *Not in your lists* | 0 |
| **Reddit** | General internet | S25 | ~15,877 |
| **4chan Boards** | Degen crypto | S01, S09 | ~11,896 |
| **Sports Stats** | Sports bettors | S14 | ~1,833 |
| **Esports** | Esports community | S15 | ~2,728 |
| **USGS Earthquakes** | Geophysics community | S19 | ~1,103 |
| **NOAA Weather** | Weather enthusiasts | S19 | ~1,103 |
| **Wildfire Tracking** | Fire services, insurance | S19, S23 | ~6,212 |
| **Disease Tracking** | Biotech, public health | S16 | ~10,716 |
| **Space Weather** | Space community | S18 | ~5,448 |
| **ISS Tracker** | Space enthusiasts | S18 | ~5,448 |
| **Military Aircraft** | Defense/OSINT community | S18 | ~5,448 |
| **Global Flights** | Aviation industry | S18 | ~5,448 |
| **Ship Tracking** | Maritime/shipping | S17 | ~6,261 |
| **eBird** | Birding community | *Not in your lists* | 0 |
| **PubMed Medical** | Biotech researchers | S16 | ~10,716 |
| **OpenAlex Papers** | Academics | S16 | ~10,716 |
| **Zillow Real Estate** | Real estate analysts | S22 | ~10,031 |
| **NRC Nuclear** | Energy analysts | S17 | ~6,261 |
| **Best Buy Products** | Retail analysts | S25 | ~15,877 |

---

## GAPS IN YOUR LISTS (communities you DON'T have yet)

These are natural Vision audiences that are MISSING from your 101K leads:

| Missing Community | Vision Source | Where to Find Them | Est. Size |
|---|---|---|---|
| **Anime/manga fans** | AniList | MyAnimeList forums, anime Reddit, AniList Discord | Millions, target 5K |
| **Dev community (pure)** | npm, PyPI, GitHub, Crates | Dev Twitter, HN, Reddit r/programming | Target 10K |
| **Weather hobbyists** | NOAA, Open-Meteo | Weather forums, r/weather, storm chasing communities | Target 2K |
| **Birders / naturalists** | eBird, iNaturalist | eBird forums, Audubon Society, r/birding | Target 1K |
| **Board gamers** | BGG | BoardGameGeek forums | Target 1K |
| **TF2 traders** | Backpack.tf | TF2 trading communities | Target 500 |
| **OSINT community** | Military Aircraft, AIS Ships | OSINT Twitter, Bellingcat community | Target 3K |
| **Nuclear energy** | NRC Nuclear | Nuclear engineering forums, r/nuclear | Target 500 |
| **Transit geeks** | GTFS Transit | Transit forums, urbanist communities | Target 1K |
| **Surf/ocean** | NDBC Buoys, NOAA Tides | Surfline community, sailing forums | Target 2K |
| **Polymarket power users** | Polymarket Predictions | Polymarket Discord, CT prediction market traders | Target 5K |

**These gaps are your BIGGEST opportunity.** Your existing lists are 73.8% "Financial Services" industry. Vision's edge is the 79 exotic data sources that map to NON-financial communities.

---

## RECOMMENDED CAMPAIGN STRUCTURE (700 emails/day)

### Phase 1: Core Crypto (Weeks 1-3)
700/day across these segments in this order:

| Day | Segment | Leads | Offer |
|---|---|---|---|
| 1-5 | S01 Crypto Traders | 3,528 | Python bot template + API key |
| 6-8 | S05 Crypto AI/Quant | 3,450 | Training dataset + API key |
| 9-12 | S02 Crypto Protocols | 4,653 | API integration + custom endpoint |
| 13-15 | S03 Crypto VCs | 2,152 | Alpha access + roadmap input |
| 16-18 | S06 Crypto Media | 4,295 | Funded account + story angle |
| 19-21 | S04 Crypto Exchanges | 2,749 | White-label proposal |

### Phase 2: Trading Adjacent (Weeks 4-5)
| Day | Segment | Leads | Offer |
|---|---|---|---|
| 22-25 | S10 Quant Traders | 6,510 | "CFTC + FRED + FINRA markets, Python built-in" |
| 26-27 | S12 Hedge Funds | 4,670 | "Alternative data alpha" pilot |
| 28-30 | S13 Betting/Gaming | 3,611 | "Same pari-mutuel model, exotic markets" |

### Phase 3: Data Source Verticals (Weeks 6-8)
| Day | Segment | Leads | Offer |
|---|---|---|---|
| 31-33 | S17 Energy/Commodities | 6,261 | "EIA data is now tradeable" |
| 34-35 | S18 Space/Defense | 5,448 | "ISS altitude market, 4 traders" |
| 36-37 | S19 Weather/Climate | 1,103 | "You check NOAA daily. Now it pays." |
| 38-39 | S16 Biotech | 10,716 | "PubMed publication trends are markets" |

### Phase 4: Follow-ups + New Lists (Weeks 9+)
- 3-email follow-up sequence on all Phase 1-3 non-responders
- Build the MISSING community lists (anime, dev, OSINT, surf, birding)
- Email S09 Pure Crypto (8,368) with generic awareness campaign

### DO NOT EMAIL FOR VISION:
- S20 TradFi Asset Managers (29,791) — save for Index/ITP
- S21 ETF/Index (973) — save for Index/ITP
- S26 Payments Non-Crypto (15,237) — no angle
- S28 Compliance Non-Crypto (6,861) — no angle

---

## SEGMENTATION DIMENSIONS USED

Not just job title. Every lead was classified using 8 signals:

1. **Company description keywords** — what the company actually does (most reliable)
2. **Headline** — how the person describes themselves on LinkedIn
3. **Professional summary** — skills, experience, domain expertise
4. **Job title** — role-based (CEO, CTO, Biz Dev, etc.)
5. **Industry + Sub-industry** — LinkedIn taxonomy
6. **Company domain** — .xyz, .io, .finance → crypto signals
7. **Company size** — startup (0-25) vs enterprise (10K+) affects decision speed
8. **Tag combinations** — CRYPTO + TRADING is different from CRYPTO + VC_INVESTOR

A lead tagged `CRYPTO + TRADING + AI_DATA` (segment S01 + S05) is your ideal user.
A lead tagged `TRADFI_AM + INSURANCE` (segment S20 + S23) will never use Vision in alpha.

---

## CROSS-LIST CONTAMINATION (your lists are messy)

Your list names don't match their contents:

| List Name | What You'd Expect | What's Actually In It |
|---|---|---|
| Crypto (22,760) | 100% crypto | 33% crypto, 36% unclassified, 20% payments |
| Crypto Biz Dev (6,788) | Crypto biz dev managers | 46% unclassified, 23% payments, 21% crypto |
| Crypto VCs (1,182) | Crypto VCs | 75% unclassified, 17% VC, 10% crypto |
| M Biotech (14,070) | Biotech companies | 67% biotech, 29% unclassified |
| Hiring (12,658) | Hiring crypto people | 78% unclassified, 6% media |
| Random Asset Mgmt (19,616) | Random asset managers | 63% TradFi AM, 19% unclassified |
| Sport Betting (3,155) | Betting companies | 45% betting, 44% unclassified |
| Asset Managers USA (13,359) | US asset managers | 41% unclassified, 29% TradFi |

**Recommendation**: Don't trust list names. Use the tag-based segments above instead. Re-assign leads to campaigns based on their TAGS, not their current list.
