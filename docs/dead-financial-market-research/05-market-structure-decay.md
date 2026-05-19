# 05 · Market Structure Decay — The Migration to Off-Exchange

Where retail orders go now versus where they used to go. The visible exchange has hollowed.

---

## A · Off-exchange / dark pool / internalization share of US equity volume

The single clearest market-structure trend of the last decade.

| Year | Off-exchange share of consolidated tape | Source |
|------|------------------------------------------|--------|
| 2010 | ~30%                                      | SEC Concept Release |
| 2013 | ~36%                                      | Tabb Group |
| 2015 | **~35–37%**                               | Cboe Market Share data |
| 2018 | ~38%                                      | Cboe |
| 2020 | ~41%                                      | Cboe + Bloomberg Intelligence |
| 2022 | ~43%                                      | Cboe |
| 2023 | ~46%                                      | Cboe / SIFMA |
| 2024 | **~48–52%**                               | Cboe / SIFMA — crossed 50% in some weeks |

**By late 2024 the off-exchange share routinely exceeded 50% of consolidated tape volume.** This is the dominant story: more than half of US equity trading no longer happens on a public, lit exchange. It happens in:

- Wholesaler internalization (Citadel Securities, Virtu/KCG, Susquehanna G1X, Two Sigma Securities)
- Dark pools / ATSs (Cboe BIDS, MS POOL, Sigma X, UBS ATS, JPMX, etc.)
- Single-dealer platforms
- Periodic auction venues

Source: **Cboe US Equities Market Volume Summary** — `https://www.cboe.com/us/equities/market_statistics/`

### Number of US equity venues (the fragmentation paradox)
- 2010: ~13 lit exchanges + ~30 dark pools = ~43 distinct venues
- 2025: ~16 lit exchanges + ~30+ dark pools = ~46+ distinct venues
- Source: SEC Market Structure overview

Fragmentation should have benefited retail (more competition). In practice the fragmentation is the **HFT feature**, not a retail one — only firms with cross-venue connectivity exploit it.

---

## B · Retail order share routed to wholesalers (PFOF as captive flow)

Source: SEC Rule 606 reports filed quarterly by each broker. The percentage of marketable retail orders sold to wholesalers:

| Broker | % marketable retail orders routed to wholesalers (2024) | Top recipients |
|--------|--------------------------------------------------------|----------------|
| Robinhood | **~100%** (all marketable equity orders) | Citadel Securities ~40%, Virtu ~30%, Susquehanna ~15% |
| Webull | ~100% | Citadel, Virtu, Two Sigma, JST |
| eToro USA | ~100% (via Apex Clearing) | Citadel, Virtu, HRT, Jane Street |
| Schwab | ~85% | Citadel, Virtu, GTS, Two Sigma |
| E*TRADE (MS) | ~90% | Citadel, Virtu |
| Fidelity | ~85% (varies by order type) | Citadel, Virtu, G1X |
| IBKR Lite | ~95% | mixed |
| IBKR Pro | **0%** (the Pro tier explicitly refuses PFOF) | n/a — direct routing |

Source: each broker's quarterly Rule 606 disclosure — `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=606`

**The story**: the entire retail-broker tier is captive flow for ~5 wholesalers. Citadel Securities alone reads roughly 40% of all US retail equity flow before it touches any exchange.

---

## C · Exchange revenue from data + co-location (the renter's cut)

The exchanges themselves benefit from the arms race. They sell premium data feeds, co-location cabinets, and connectivity.

### NYSE / ICE
- Co-location revenue (within "Data & Connectivity" segment): ~$1B+ annually by 2024.
- Premium proprietary data feeds (Integrated Feed, XDP) revenue grew from ~$150M (2015) to **~$500M (2024)**.
- Source: ICE 10-K filings — `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001571949`

### Nasdaq
- "Market Services" segment includes co-location and direct-feed revenue.
- 2024 co-lo + data ~$700M.
- Source: Nasdaq 10-K filings.

### CME Group
- Data & Co-location revenue ~$300M in 2024.
- Aurora IL facility is THE futures-trading data center.
- Source: CME 10-K filings.

### Cboe Global Markets
- Acquired BIDS Trading 2021, ErisX 2022 (later wound down), MATCHNow 2020, etc. — consolidating venues.
- Data & connectivity ~$400M+ in 2024.

**The market pays the exchanges to host the algos that prey on the market.**

---

## D · ETF concentration — the substitute "retail" allocation

The hollowing of single-name listings forces retail into ETFs.

- Number of US-listed ETFs:
  - 2010: ~900
  - 2015: ~1,500
  - 2020: ~2,200
  - 2024: **~3,500+**
- ETF AUM 2024: **~$8.5T**, up from ~$2T (2015). Source: ICI Factbook.

This sounds democratizing. It isn't — most retail money flows to ~10 mega-cap ETFs (SPY, VOO, QQQ, IVV, VTI). The "diversification" is concentration in the same names institutional money is in.

Number of US public listings:

| Year | US-listed companies | Source |
|------|---------------------|--------|
| 1996 | **~8,090** (the peak) | Wilshire |
| 2005 | ~6,200 | Wilshire |
| 2015 | ~4,500 | Wilshire |
| 2020 | ~4,300 | Wilshire |
| 2024 | **~4,300** | Wilshire / WSJ |

The number of public companies **roughly halved in 25 years** as private capital deepened. Retail can no longer participate in the early growth of the largest companies — that growth happens in private rounds retail cannot access.

---

## E · Options market — the 0DTE explosion

0DTE = options expiring same trading day.

- 2015: 0DTE represented ~5% of SPX options volume.
- 2020: ~17%.
- 2022: launch of Tue/Thu expiries on SPX — daily-expiry available.
- **2024: 0DTE represents ~50% of all SPX options volume.** Some days exceed 55%.
- Source: CBOE Global Markets daily options data — `https://www.cboe.com/us/options/market_statistics/`

Retail share of options volume:
- 2015: ~10%
- 2020: spiked during pandemic to ~25%
- 2024: ~25–30%

**Retail in 2015 traded weekly SPY and monthly LEAPS. Retail in 2025 trades same-day SPX 0DTE.** The reward function has been shortened to lottery-ticket time horizons. This is not retail demand. This is exchange and wholesaler engineering.

---

## F · Spread compression as a misleading metric

The standard pro-PFOF defense is: spreads narrowed, retail benefits.

The honest counter:

### Quoted spreads narrowed
- 2015 SPY average quoted spread: ~0.7 bps
- 2024 SPY average quoted spread: ~0.4 bps (similar for other mega-cap names)

### But retail does not get the quoted spread
- Schwarz, Barber, Huang, Liu (Journal of Finance 2025), "The Actual Retail Price of Equity Trades" — measured **7–46 bps round-trip** effective spread across six retail brokers, depending on which broker and which name.
- The midpoint of that range (17 bps) is the figure used in `data-edge-ways.ts` for the PFOF mechanism.

So while quoted spreads compressed by ~40% over the decade, the retail-realized spread on a typical round-trip is **~30–60×** the quoted top-of-book spread.

This is the page's central reveal. Quoted improvement, realized degradation. The book gets tighter while the customer gets cleaner-fleeced.

Source: Schwarz et al. (JF 2025) — `https://onlinelibrary.wiley.com/doi/10.1111/jofi.13392` (or the SSRN preprint)

---

## G · Maker-taker rebate complexity (the unreadable fee book)

- 2010: typical US equity exchange had ~6–8 order types.
- 2024: NYSE has **~80+ distinct order types**; Nasdaq has ~70+; Cboe BZX ~70+.
- Each order type has different rebate / fee treatment depending on tier and venue.

The complexity is the moat — only firms with full-time market-structure analysts can navigate the rebate maze profitably. Retail picks one default order type and pays the worst execution.

Source: each exchange's order-type rule books, filed with SEC. e.g. NYSE Rule 7.31.

---

## H · Treasury market — the PTF takeover (recap from file 03)

Repeated here for completeness because Treasury market change is one of the under-cited proofs.

- 2014: PTFs ~30% of secondary on-the-run Treasury volume.
- 2022: PTFs **~60%+** per Federal Reserve / Treasury studies.

The structural change is invisible to retail because retail doesn't trade Treasuries directly. But the macro impact is: when the Treasury market seized in March 2020, the PTFs withdrew liquidity faster than primary dealers ever did, requiring Fed intervention to restore function.

Sources:
- US Treasury / OFR working papers
- Joint Staff Report on October 15, 2014 Treasury Market Volatility

---

## I · FX market — the non-bank takeover

- 2013: non-bank LPs ~5% of inter-dealer FX.
- 2022 (BIS Triennial): non-bank LPs **~30%+**.

XTX Markets, Citadel Securities FX, Jump Trading, Hudson River Trading, Virtu, GTS — these names dominate the spot FX inter-dealer book.

Retail FX (CFD brokers) experiences this through *last-look* rejection and dealer-aggregated quote markups.

Source: BIS Triennial 2022 — `https://www.bis.org/statistics/rpfx22.htm`

---

## J · Exchange consolidation — fewer venues, more roof-top extraction

| Acquisition | Year | Value |
|-------------|------|-------|
| ICE → NYSE | 2013 | $8.2B |
| Cboe → BATS Global Markets | 2017 | $3.2B |
| LSE → Refinitiv | 2021 | $27B |
| Nasdaq → AxiomSL | 2021 | $0.65B |
| Cboe → BIDS Trading | 2021 | $0.36B |
| ICE → Black Knight | 2023 | $11.7B |
| Nasdaq → Adenza | 2023 | $10.5B |

Each consolidation tightens the rent. By 2024 essentially three companies (ICE, Nasdaq, Cboe) operate the US equity-exchange complex and extract data fees from every participant — including the participants they sell co-location to.

Source: respective press releases and 8-K filings.

---

## K · 24/7 trading — extending the surface area for extraction

- 2015: US equities open 9:30–16:00 ET. Pre-market and after-hours thin.
- 2020: pandemic-driven extended hours expanded.
- 2024: NYSE and Nasdaq announced moves toward **22-hour trading days** (5am–11pm ET) pending SEC approval.
- 2024: Robinhood expanded 24/5 equity trading.
- 2024: Interactive Brokers offers 24-hour US equity trading on overnight session via OvernightX.

Why this matters: liquidity in overnight sessions is thinner; spreads wider; whoever is the only market maker at 3am wins more decisively. Trading hours expansion creates surface area for wholesalers, not for retail.

Sources:
- NYSE proposal coverage (Bloomberg, WSJ 2024)
- Robinhood press releases on 24/5 equities

---

## L · Crypto venue concentration

A counterpart trend in crypto.

- Binance share of global crypto spot volume: ~60% (2021) → ~45% (2024) — slight decline, but still dominant.
- Top-5 CEXs: 80%+ of all centralized volume.
- Top-3 DEXs (Uniswap, PancakeSwap, Hyperliquid): >70% of DEX volume.
- Sonic + Solana + BNB Chain: dominant for memecoin / Pump.fun activity.

Source: CoinGecko, DefiLlama dashboards.

The 2017–2019 era of ~200 active CEXs has consolidated to a tight oligopoly of major venues, each of which runs an MM-incentive program that subsidizes the top 5 MMs.

---

## M · Source bibliography

- Cboe US Equities Market Volume Summary
- SEC Rule 606 reports (each broker)
- NYSE, Nasdaq, Cboe, CME 10-Ks
- Schwarz et al. (Journal of Finance 2025)
- CBOE options daily data
- BIS Triennial Surveys
- US Treasury / OFR working papers
- Joint Staff Report on October 15, 2014
- ICI Factbook (ETF AUM)
- Wilshire / WSJ (US listed-company count)
- CoinGecko, DefiLlama (crypto venue concentration)

---

## N · What's missing

1. Quarterly off-exchange share data for the curve chart — needs Cboe pull.
2. Precise 2025 numbers for everything — most full-year figures unavailable until Q1/Q2 2026.
3. Order-type count per exchange over time — has been growing but I don't have a clean year-by-year series.

---

End of file. Next: `06-arms-race-and-baseline.md` — the Then-vs-Now table data.
