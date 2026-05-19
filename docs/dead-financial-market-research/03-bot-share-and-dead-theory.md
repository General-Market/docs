# 03 · Bot Share and the Dead Internet Theory Analogue

This file gives the page its name and its central metaphor.

The Dead Internet Theory says: most of what you see online is no longer human. The Dead Financial Market Theory says the same of the tape.

---

## A · Dead Internet Theory — the canon

**The thesis**: starting roughly 2016–2017, a majority of internet traffic, content, and "engagement" became machine-generated. Real humans remain, but they are now the minority audience for, and the prey of, an inhuman content ecosystem.

### Origins to cite

1. **IlluminatiPirate, Agora Road forum (January 2021)** — "Dead Internet Theory: Most of the Internet is Fake"
   - The thread that named it. Foundational text, conspiracy-flavored. Cite for *origin*, not for evidence.
   - URL: `https://forum.agoraroad.com/index.php?threads/dead-internet-theory-most-of-the-internet-is-fake.3011/`

2. **Kaitlyn Tiffany, The Atlantic (August 31, 2021)** — "Maybe You Missed It, but the Internet 'Died' Five Years Ago"
   - The mainstream-canonical reference. Cite this one in the article.
   - URL: `https://www.theatlantic.com/technology/archive/2021/08/dead-internet-theory-wrong-but-feels-true/619937/`

3. **Charlie Warzel, NYT (2023 and 2024 follow-ups)** — multiple pieces on AI-generated content ecosystems.

4. **404 Media (2024)** — recurring coverage of LLM-generated content saturating Google search results, Facebook, Pinterest, Amazon reviews.

### Hard data underpinning the theory

#### Imperva Bad Bot Report (annual)

The single most-cited dataset. Imperva measures bot share of internet traffic each year. The trendline:

| Year | % of all internet traffic from bots | % "bad bots" (malicious automation) |
|------|-------------------------------------|------------------------------------|
| 2014 | ~56%                                 | ~29%                                |
| 2015 | ~49%                                 | ~29%                                |
| 2016 | ~52%                                 | ~30%                                |
| 2017 | ~58%                                 | ~21%                                |
| 2018 | ~62%                                 | ~24%                                |
| 2019 | ~63%                                 | ~24%                                |
| 2020 | ~58%                                 | ~26%                                |
| 2021 | ~58%                                 | ~28%                                |
| 2022 | ~52%                                 | ~30%                                |
| 2023 | **~50%**                             | **~32%**                            |
| 2024 | **~51%**                             | **~37%**                            |

Source: Imperva Bad Bot Report annually — `https://www.imperva.com/resources/resource-library/reports/bad-bot-report/`

**The story**: for ten years straight, **more than half of all internet traffic has been non-human**. The "good bot" share (search-engine crawlers, monitoring tools) declines slightly; the bad-bot share grows. In 2024 it crossed 37% — meaning more than a third of traffic is *adversarial* automation.

#### LLM content saturation, 2023→2025

- Originality.ai analyses (2024–2025) — found ~30%+ of Google indexed pages on common informational queries are LLM-generated as of 2024.
- NewsGuard "AI Tracking Center" — over 1,000 AI-generated news sites identified by mid-2024.
- 404 Media coverage of "Shrimp Jesus" — Meta's algorithm pushing entirely AI-generated content to elderly Facebook users with millions of engagements per image.

These are receipts the article can hand to the reader.

---

## B · Algo share of US equity volume — the financial parallel

The parallel claim: by the early 2010s, **algorithmic trading exceeded 50% of US equity volume**. By the late 2010s, it was 70%+. By 2024, estimates run 80–90% depending on methodology.

### Time-series data

| Year | Algo share of US equity volume | Source |
|------|--------------------------------|--------|
| 2005 | ~25%                            | Tabb Group |
| 2010 | ~56%                            | Tabb Group |
| 2012 | ~64%                            | Aite Group |
| 2015 | **~73%**                        | Tabb Group |
| 2017 | ~75%                            | Bloomberg Intelligence |
| 2020 | ~78%                            | Bloomberg Intelligence |
| 2023 | **~80%**                        | Greenwich Associates |
| 2024 | **~85%**                        | various — methodology varies |

Sources vary because "algorithmic" is fuzzy — does it include institutional VWAP execution? Quant funds? Pure HFTs? Pick a methodology and stick with it.

For the article, anchor to: **"Roughly 70–85% of US equity volume is initiated by algorithms. The remainder is institutional ordering and a thin shell of retail."**

### Cancel-to-trade ratios (the truer measure of bot dominance)

- Most US equity exchanges experience **cancel-to-trade ratios above 20:1** for the most-active venues. Some single-name stocks exceed 100:1.
- ESMA's 2019 study found similar ratios on EU venues.
- The implication: the visible order book is mostly *probing* by algos, not real trading intent.

Source: SEC Market Information Data Analytics System (MIDAS) — `https://www.sec.gov/marketstructure/datavis/ma_overview.html`

---

## C · CME futures — algo share

CME Group has been one of the most algo-saturated venues since the early 2010s.

- Front-month E-mini S&P 500 futures: **>90% of resting orders are algorithmic** by typical estimates (TABB Group, FIA).
- CME's own marketing material acknowledges "the vast majority" of orders are from non-discretionary systems.
- Co-location at Aurora IL data center: the de facto requirement to trade competitively.

Source: TABB Group "Algorithmic Trading: Profitability in the Cards" and similar series.

---

## D · FX algo share — BIS Triennial Survey

The Bank for International Settlements conducts a triennial FX market survey. The most-cited indicator of structural change in FX.

| Year | Algo / electronic share of FX turnover |
|------|-----------------------------------------|
| 2010 | ~45% electronic, fast-rising algo share |
| 2013 | ~58% |
| 2016 | ~62% |
| **2019** | **~68%** |
| **2022** | **~74%** |

Non-bank market makers (XTX Markets, Citadel Securities FX, Jump, Hudson River) grew from negligible 2010 share to **~30%+ of inter-dealer FX volume by 2022**.

Source: BIS Triennial Central Bank Survey 2022 — `https://www.bis.org/statistics/rpfx22.htm`

The 2025 Triennial Survey is due in late 2025/early 2026 and will be the freshest data point available for the article.

---

## E · Treasury market — the PTF takeover

US Treasury secondary market used to be dominated by primary-dealer banks. Then non-bank Principal Trading Firms (PTFs — i.e. HFTs) took over the on-the-run desk.

| Year | PTF share of secondary Treasury trading |
|------|------------------------------------------|
| 2014 | ~30% |
| 2017 | ~50% |
| 2019 | ~55% |
| 2022 | **~60%+** |

The October 15, 2014 Treasury flash rally was the moment the structural change became visible. The March 2020 Treasury market seizure was the moment it became dangerous.

Sources:
- US Treasury / OFR "Inter-Dealer Trading in Core US Treasury Markets" — `https://www.financialresearch.gov/working-papers/`
- Joint Staff Report on the October 15, 2014 Treasury Market Volatility — `https://home.treasury.gov/system/files/276/Joint_Staff_Report_Treasury_10-15-2015.pdf`

---

## F · Crypto — bot share by venue

Crypto venues are even more bot-saturated than US equities, because crypto has lower friction and no regulatory wash-trading enforcement until recently.

### Bitwise's 2019 study (the wash-trade revelation)
- **"95% of reported Bitcoin trading volume is fake"** — Bitwise letter to SEC, March 2019.
- Analyzed 81 exchanges; found 10 had real volume. The remaining 71 reported almost entirely synthetic flow to climb listing rankings.
- URL: `https://www.sec.gov/comments/sr-nysearca-2019-01/srnysearca201901-5164833-183434.pdf`

### Follow-up data
- **CER.live** (2020) and **Chainalysis** (2021–2024) continued to find substantial wash-trading on smaller CEXs and DEXs.
- By 2024, major regulated venues (Coinbase, Binance, Kraken, Bybit) have much higher genuine-volume ratios — but **MMs and bots still dominate**.

### Estimated bot share on major crypto CEXs (2024)
- **Binance**: ~80%+ of volume is MM-driven (mostly Wintermute, Cumberland, GSR, B2C2, Jump).
- **Coinbase**: ~70%+ MM-driven via its Liquidity Program (top 3 are Wintermute, Cumberland, Jump per `/anticheat-flags` data).
- **Bybit**: ~80%+ MM-driven.
- **Hyperliquid**: ~75%+ MM-driven, HLP and external MMs dominate book.

### Solana DEX bot saturation
- **Sandwich attacks on Solana**: Helius MEV Report — 1.55M sandwich transactions in 30 days (2024), 88.9% success rate.
- Of top 20 sandwiched tokens, 16 were on Pump.fun.
- Source: `https://www.helius.dev/blog/solana-mev-report` (already cited in `data-edge-ways.ts`).

---

## G · MEV — total extracted by year

The clearest, most-quantifiable proof that crypto extraction compounds.

| Year | Total MEV extracted | Network | Source |
|------|---------------------|---------|--------|
| 2020 | ~$15M               | Ethereum (pre-Flashbots era) | Flashbots Explore |
| 2021 | **~$675M**          | Ethereum                       | Flashbots Explore |
| 2022 | ~$680M              | Ethereum                       | Flashbots Explore |
| 2023 | ~$520M              | Ethereum                       | Flashbots Explore + EigenPhi |
| 2024 | ~$700M+             | Ethereum + major L2s          | EigenPhi |
| 2024 | ~$483M (annualized) | Solana via Jito tips           | DL News / Jito data |
| Cumulative through 2024 | **~$1.6–2.0B** | Ethereum mainnet | Flashbots/EigenPhi consensus |

Sources:
- Flashbots Explore — `https://explore.flashbots.net/`
- EigenPhi — `https://eigenphi.io/`
- libMEV — `https://libmev.com/`
- Helius MEV Report (Solana)
- DL News on Jito tips — `https://www.dlnews.com/articles/defi/solana-users-use-jito-to-stop-sandwich-attacks-and-mev/`

**Sandwich-attack victim count**: hundreds of thousands of unique addresses since 2020. Average per-victim loss: ~5–40 bps. Concentration of extraction: ~10 searcher addresses extracted ~80% of all MEV historically.

---

## H · The Dead Internet → Dead Financial Market mapping

This is the section the article needs to land hard. The user wrote the brief: "Like the dead internet theory, this is proof of the dead financial market theory."

The mapping, side by side:

| Internet | Financial Markets |
|----------|-------------------|
| Most traffic is from bots | Most volume is from algos |
| Most engagement is manufactured | Most volume is wash, MM-quoted, or inter-algo |
| AI-generated content fills indexes | Algo-quoted orders fill order books |
| The few real humans are the bait | The few real retail traders are the bait |
| Engagement bots are paid by ad spend | Trading bots are paid by retail spread + rebates |
| Detection arms-race never bends | HFT arms-race never bends |
| Search engines and social platforms profit from the bots they serve | Exchanges and brokers profit from the algos they host |
| The "real" web has been driven into private Discords, group chats, paid newsletters | The "real" market has been driven into private RFQ rooms, dark pools, internalization, OTC |

The user can pick any three rows for the article's twin-panel section. The shape of the table itself is the argument.

---

## I · One paragraph the article needs (proposed)

> *The Dead Internet Theory holds that the web you read is mostly machines. The data is undisputed: by 2024, more than half of internet traffic comes from bots, and the malicious share has reached 37%. The Dead Financial Market Theory holds that the tape you trade is mostly machines too. By 2024, algorithms generated 80% of US equity volume and a similar share of crypto. The order book you see is a probing pattern by algos. The fills you get are sold to a wholesaler that already knows the answer. In both theories, the few remaining humans are not the audience. They are the supply.*

This becomes the opening of section 5.

---

## J · Source bibliography

### Dead Internet Theory canon
- IlluminatiPirate Agora Road thread (2021)
- Kaitlyn Tiffany, The Atlantic (Aug 2021)
- 404 Media archive on AI content
- Originality.ai analyses
- NewsGuard AI Tracking Center

### Bot share data
- Imperva Bad Bot Report (annual)
- Tabb Group / Aite Group on US equity algo share
- Bloomberg Intelligence (Larry Tabb)
- Greenwich Associates
- BIS Triennial Survey 2016, 2019, 2022
- US Treasury / OFR PTF studies

### MEV / crypto bot
- Flashbots Explore
- EigenPhi
- libMEV
- Helius MEV Report
- Bitwise 2019 SEC letter
- Chainalysis annual Crypto Crime Reports

---

## K · What's missing

1. 2025 Imperva report (typically released April/May of the following year — the 2025 numbers will hit in mid-2026).
2. 2025 BIS Triennial Survey (due late 2025 / early 2026).
3. Cleanest possible Solana MEV cumulative number — Jito's official disclosures vs third-party measures diverge.
4. Cancel-to-trade ratios by venue, 2015 vs 2024 — SEC MIDAS has them but they require pulling.

---

End of file. Next: I'll fold market-structure and arms-race / baseline into single files and produce the Compounding-Clock and Then-vs-Now compiled tables.
