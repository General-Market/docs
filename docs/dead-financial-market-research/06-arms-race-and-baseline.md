# 06 · AI Arms Race + 10-Year Baseline — The Spine of the Then-vs-Now Table

This file powers section 6 of the page (Then vs Now) and section 3 (Compounding Clock). Every row here pairs a 2015 (or 2014–2016 cluster) value with a 2024–2025 value.

---

## A · The AI / quant arms race over the decade

### A.1 — Quant pod-shop AUM (top 8 multi-strats)

Consolidated from file 02:

| Firm | 2015 AUM | 2024 AUM |
|------|----------|----------|
| Citadel (flagship hedge fund, separate from Citadel Securities) | ~$25B | ~$65B |
| Millennium Management | ~$33B | ~$72B |
| Two Sigma | ~$30B | ~$60B |
| DE Shaw | ~$36B | ~$70B |
| Point72 | ~$11B | ~$36B |
| Balyasny | ~$8B | ~$25B |
| ExodusPoint | (founded 2018) | ~$13B |
| Schonfeld Strategic | ~$5B | ~$13B |
| **Top 8 combined** | **~$150B** | **~$350B+** |

Leverage typical of these funds is 5–8×, meaning footprint is well over $2T by 2024.

`[VERIFY]` — pod-shop AUM is reported quarterly to LPs but only sporadically leaked.

### A.2 — Renaissance Medallion (the inaccessible benchmark)

- Closed to outside capital since 1993 (re-confirmed many times).
- Returns: ~66% gross / ~39% net annualized 1988–2018 per Greg Zuckerman, *The Man Who Solved the Market* (2019).
- 2020: Medallion reportedly returned ~76%; outside Renaissance funds (RIEF, RIDA, RIDGE) **lost** money the same year — confirming the inside/outside divergence.
- 2021–2024: Medallion has continued to outperform; outside funds restructured.
- Source: Bloomberg, WSJ, Greg Zuckerman's reporting.

The point for the article: **the best fund in history has been closed to outside investors for 30+ years**. Retail cannot buy into it. The alpha exists, behind a door that is shut and bolted.

### A.3 — New-grad PhD compensation (the talent price)

| Year | Median total comp, fresh quant PhD at top HFT/MM/quant fund | Source |
|------|--------------------------------------------------------------|--------|
| 2015 | ~$300–400K | eFinancialCareers, Glassdoor (broad estimates) |
| 2020 | ~$500–700K | eFinancialCareers, WSO |
| 2023 | ~$700K–$1M | WSJ "Quants on Fire" series, eFinancialCareers |
| 2024 | **$800K–$1.5M** for elite ML PhDs (Jane Street, HRT, Citadel Sec) | WSJ Sept 2024 "The $1m-a-year fresh PhD" |

Jane Street specifically:
- New-grad Quantitative Trader 2024: ~$400-450K base + sign-on + first-year bonus reportedly putting total Y1 comp ~$700K–$1.2M.
- Source: WSO compensation database, interview-blog disclosures.

Apple comparison: Apple new-grad SWE total comp ~$200–300K in 2024.

The HFT industry pays **3–5× tech-FAANG rates for the same PhDs**. They can afford it.

### A.4 — GPU procurement (the compute moat)

- **Jane Street** — placed reportedly large H100 orders 2023–2024. Bloomberg coverage estimated **"thousands to tens of thousands"** of NVIDIA H100s.
- **Citadel** — Ken Griffin in public interviews (Bloomberg Invest 2024) confirmed Citadel as one of the largest non-AI-lab buyers of H100s.
- **Hudson River Trading** — announced multi-data-center expansions 2023–2024.
- **Susquehanna** — reportedly large H100 buyer.

No HFT firm discloses precise GPU counts. The signal is: when NVIDIA reports earnings, allocation goes to "AI labs, hyperscalers, and select sovereign and HFT customers."

### A.5 — Alternative-data spend industry-wide

| Year | Total industry alt-data spend | Source |
|------|--------------------------------|--------|
| 2015 | ~$0.6B | Neudata / Eagle Alpha |
| 2020 | ~$1.7B | Neudata |
| 2024 | **~$4B+** | Neudata 2024 report |

Top alt-data buyers: top 50 hedge funds + top 5 HFTs consume ~80% of spend.

### A.6 — Latency arms race

- Latency NY → Chicago (most-trafficked HFT corridor):
  - 2010: ~16ms (fiber)
  - 2015: ~8ms (microwave, Spread Networks era)
  - 2020: ~7ms (maxed microwave)
  - 2025: **~6.5ms** (maxed microwave + laser links + atmospheric refinements)
- The remaining microseconds are now extracted via:
  - Trans-Atlantic microwave (London ↔ Frankfurt): ~6.6ms vs ~7.2ms fiber.
  - Cross-Asia: Tokyo ↔ Hong Kong via undersea + microwave.
  - **Cermak Chicago Equinix CH1 to CME Aurora**: down to ~36 microseconds for top tiers as of 2024.

Source: McKay Brothers, Quincy Data published latency tables, Anova marketing materials. Plus FIA documentation.

The marginal microsecond costs millions. The reinvestment loop pays it back.

### A.7 — Conference and recruiting indicators

- NeurIPS sponsor list 2015: ~15 corporate sponsors, almost no HFT firms visible.
- NeurIPS 2024 sponsor list: ~80+ corporate sponsors; **Jane Street, Hudson River, Citadel Sec, Two Sigma, DE Shaw, Optiver, Jump** all at top-tier sponsor levels.
- Source: NeurIPS sponsor pages (archived).

ICML and ICLR similar pattern — quant fund recruiters dominate the careers fair.

---

## B · The 10-years-ago baseline (2014–2016) — the lost world

Each row is a 2015 baseline value the article will pair with a 2024–2025 value.

### B.1 — MEV
- **2015**: Ethereum mainnet launched July 30, 2015. No MEV. The term itself ("Miner Extractable Value") was coined by Phil Daian et al. in the 2019 paper "Flash Boys 2.0."
- **2025**: ~$1.6–2.0B cumulative MEV on Ethereum since 2020. ~$700M+/yr industry-wide including Solana.

### B.2 — PFOF
- **2015**: industry PFOF total estimated ~$0.6–0.8B. Pre-Robinhood scale.
- **2024**: ~$3.7B industry-wide. Robinhood alone ~$0.7B.

### B.3 — Citadel Securities revenue
- **2015**: ~$1.7B.
- **2024**: ~$11–12B (record).

### B.4 — Jane Street revenue
- **2015**: undisclosed. Estimated ~$1–2B based on later disclosures.
- **2024**: ~$20.5B annualized from H1 disclosure.

### B.5 — Off-exchange share of US equity volume
- **2015**: ~35–37%.
- **2024**: ~48–52%.

### B.6 — 0DTE share of SPX options
- **2015**: ~5%.
- **2024**: ~50%.

### B.7 — Algo share of US equity volume
- **2015**: ~73%.
- **2024**: ~80–85%.

### B.8 — Bot share of internet traffic (Imperva)
- **2015**: ~49% (52% in 2016).
- **2024**: ~51% total bot share; **37% malicious-bot share** (record).

### B.9 — Crypto market makers
- **2015**: essentially none. Most crypto volume was retail-vs-retail on Bitfinex, Coinbase Pro, BitMEX. Wintermute did not exist (founded 2017). GSR was small. Cumberland (DRW) was the only large institutional desk.
- **2024**: Wintermute, GSR, Cumberland, B2C2 dominate; ~70–80% of liquid CEX/DEX volume is MM-quoted.

### B.10 — Number of US public listings
- **1996** (peak): ~8,090.
- **2015**: ~4,500.
- **2024**: ~4,300.

### B.11 — Quant pod-shop top-8 combined AUM
- **2015**: ~$150B.
- **2024**: ~$350B+.

### B.12 — Latency NY → Chicago (fastest commercial link)
- **2015**: ~8ms.
- **2024**: ~6.5ms.

### B.13 — Treasury secondary market PTF share
- **2014**: ~30%.
- **2022 (latest detailed study)**: ~60%+.

### B.14 — FX algo / electronic share (BIS Triennial)
- **2016**: ~62%.
- **2022**: ~74% (next survey due 2025–2026).

### B.15 — US-listed ETFs
- **2015**: ~1,500.
- **2024**: ~3,500+.

### B.16 — Annualized retail liquidations on crypto perps
- **2015**: BitMEX existed but volumes small. Total liquidations ~$1–2B per year industry-wide.
- **2024**: ~$200B+ per Coinglass.

### B.17 — Total US options contracts traded annually
- **2015**: ~4.1B contracts.
- **2024**: **~12B+ contracts** (record year per OCC). ~3× expansion driven mostly by 0DTE.

### B.18 — Maker-taker / order-type complexity
- **2015**: typical exchange ~20–30 distinct order types.
- **2024**: ~70–80+ per exchange.

### B.19 — Alt-data spend
- **2015**: ~$0.6B industry.
- **2024**: ~$4B+.

### B.20 — Top hedge-fund AUM concentration
- **2010**: top-10 funds ~25% of total industry AUM.
- **2024**: top-10 funds **~40%+** of total industry AUM. HFR data.

---

## C · The restoration map (recap from `data-edge-ways.ts`)

What General Market's product set restores, mapped to each 2015 property that has been lost:

| 2015 property | Restoring mechanism on GM |
|---------------|--------------------------|
| No on-chain mempool to sandwich | Sealed bets. No mempool to sandwich. No validator with a side bet. |
| No PFOF surface to internalize | No order flow to sell. Bets post directly to the pool. |
| No b-book broker as counterparty | No internal book. The pool is the counterparty. |
| One flat fee, no tier table | Flat fee. One tier. |
| Book private until match | Sealed bets. The book is private until the round resolves. |
| Geography didn't pay | Global pricing function. Geography is not an input. |
| No listing-leak pipeline | Sealed bets resolved by BLS oracle. No listing pipeline to leak. |
| No maker-taker rebate game | No maker / taker model. One fee, whoever posts. |
| No single oracle to peek at | BLS-aggregated oracle consensus. No single peek. |
| Match by FIFO, not by ladder lag | No matching engine. Parimutuel pool. |
| No HFT-spin loop on rate limits | One rate, everyone. Pool resolves once per round. |
| No last-look reject window | Sealed-bid auction. No rejection step. |
| No leverage cascade to engineer | No leverage. No forced liquidation. |

Thirteen properties → thirteen restorations.

---

## D · The closer paragraph (proposed)

> *General Market is not a reform of the market. It is a restoration. Each mechanism above existed somewhere in 2015 — in a different venue, in a different protocol, in a different decade. We unbundled and reassembled them. Sealed bets, parimutuel pools, BLS oracles, blocks per minute, no leverage, no internalization. The result is a market structure that the predatory loop cannot run against. There is no mempool to sandwich. There is no flow to sell. There is no rebate ladder to climb. The few small advantages we restored to retail are enough.*

The article ends there. The CTA pills follow.

---

## E · Source bibliography

- All previously cited (see files 01–05).
- Greg Zuckerman, *The Man Who Solved the Market* (2019) — Renaissance background.
- Phil Daian et al. (2019), "Flash Boys 2.0" — MEV origin paper.
- Coinglass — crypto liquidation totals.
- OCC — options volume.
- Neudata — alt-data spend estimates.
- HFR — hedge-fund industry data.

---

End of file. Next: compiled `clock-data.ts` and `baseline-data.ts` files.
