# Angle B — The Compute and Labor Asymmetry

> **Headline candidate**: *A Jane Street new-grad PhD's first-year compensation, ~$1.2M, exceeds the lifetime trading capital of every retail account on Robinhood with a balance below the median. Robinhood's median funded-account balance is ~$240. The firm trading against them pays $1.2M to recruit one of the thousands of PhDs they hire each year.*

Markets used to be a contest between humans of comparable preparation. They are now a contest between a credentialed industrial complex and an attention surface.

---

## 1 · The compute fleet

### Jane Street
- Bloomberg ("Jane Street, AI's Quiet Whale", reported Sep 2024 onwards): Jane Street has placed orders for **thousands** of NVIDIA H100s and is one of the largest non-AI-lab purchasers.
- Some industry coverage estimates the Jane Street GPU fleet at "tens of thousands" of H100s by year-end 2024.
- Source: Bloomberg, eFinancialCareers, The Information coverage Sep–Dec 2024. `[VERIFY]` exact count — Jane Street never confirms.

### Citadel (the hedge fund) + Citadel Securities
- Ken Griffin, Bloomberg Invest 2024 and various interviews: Citadel was one of the largest non-AI-lab buyers of H100s in 2023.
- Citadel reportedly leases its compute through multiple cloud providers in addition to private data centers.
- `[VERIFY]` GPU count — undisclosed.

### Hudson River Trading
- Disclosed $100M+ data-center expansions 2023–2024 in press coverage.
- Singapore, London, Mumbai office expansions all with co-located compute.

### Susquehanna
- Reportedly large H100 buyer per Bloomberg / WSJ coverage; specific count undisclosed.

### The asymmetry
- Robinhood total technology spend 2023 (per 10-K): approximately **$0.4B**. This includes app development, customer service infrastructure, and trading-engine ops — *not* extraction compute.
- Jane Street technology spend is undisclosed but inferred to be **multiples of Robinhood's** based on headcount + GPU fleet + data-center footprint.

**The frame**: the firm trading against retail spends more on compute than the firm hosting retail spends on its entire business.

---

## 2 · The PhD wage curve

| Year | Median new-grad quant PhD total comp at top HFT/MM/quant fund | Source |
|------|---------------------------------------------------------------|--------|
| 2015 | ~$300–400K | eFinancialCareers, Glassdoor |
| 2020 | ~$500–700K | eFinancialCareers, WSO compensation database |
| 2023 | ~$700K–$1M | WSJ "Quants on Fire" series |
| 2024 | **$800K–$1.5M** for elite ML PhDs | WSJ Sept 2024 "The $1m-a-year fresh PhD" |

**Jane Street new-grad Quantitative Trader 2024** (per WSO and interview-blog disclosures):
- Base salary ~$200K
- Sign-on bonus ~$100K
- First-year performance bonus ~$200–900K (highly variable)
- **Total Y1 on-target: ~$700K–$1.2M**

### The asymmetry against the worker

| Salary tier | 2024 amount | Source |
|-------------|-------------|--------|
| Jane Street new-grad Y1 total | ~$1.2M | WSO, eFinancialCareers, WSJ |
| US median household income | ~$80K | US Census Bureau |
| US median individual wage | ~$48K | BLS |
| Apple new-grad SWE total comp | ~$200K | Levels.fyi |
| Google new-grad SWE total comp | ~$200K | Levels.fyi |
| **HFT new-grad pays 15× US median wage** | | |
| **HFT new-grad pays 6× FAANG-equivalent** | | |

The firm trading against you can pay the PhD recruiting to do the trading **fifteen times what you earn**. Not the partner. The entry-level hire.

---

## 3 · The headcount ratio

The professional extraction industry employs roughly:

| Firm | Headcount (latest disclosed) |
|------|-----------------------------|
| Jane Street | ~3,000 |
| Citadel Securities | ~2,000 |
| Hudson River Trading | ~1,000+ |
| Virtu Financial | ~1,200 |
| DRW (incl. Cumberland) | ~1,000+ |
| Susquehanna | ~3,000+ |
| Tower Research | ~500+ |
| Optiver | ~2,200 |
| IMC | ~1,500 |
| Jump Trading | ~700+ |

**Combined: ~16,000 professional traders/engineers** at the top tier of HFT and market making.

Against them:
- Global retail brokerage accounts: ~150M+ (sum of US, EU, Asian, crypto, etc.)
- US retail brokerage accounts alone: ~100M+ (Schwab/Ameritrade ~35M, Fidelity ~50M, RH ~25M, Webull ~25M, IBKR ~3M, etc., with overlap)
- Crypto retail wallets that have traded: ~500M+

**Ratio**: ~10,000 retail accounts per professional extractor. One PhD, ten thousand counterparties.

Each PhD costs ~$1M/year to staff. Each PhD trades against ~10,000 retail accounts. **The cost of staffing one PhD against you is $100/year per retail account.** That money has to come from somewhere. It comes from the spread.

---

## 4 · The data spend asymmetry

### The professional toolkit (2024 cost, single firm)

| Item | Cost |
|------|------|
| Bloomberg Terminal subscription | ~$30K/yr per seat |
| Refinitiv Eikon | ~$22K/yr per seat |
| FactSet | ~$13K/yr per seat |
| Direct exchange feeds (NYSE Integrated, Nasdaq TotalView, etc.) | $50K–$500K+/yr per venue |
| McKay Brothers NY-Chicago microwave | ~$1M+/yr per subscriber for top tier (`[VERIFY]`) |
| Co-location cabinet (NY4 / Aurora / LD4) | $15K–30K+/month per high-density cabinet |
| Alt-data subscriptions (top quant fund average) | ~$50M+/yr |

Citadel's hedge fund reportedly spends **$200M+/year on data**. Source: Bloomberg / WSJ coverage. `[VERIFY]`

### The retail toolkit (2024 cost)

| Item | Cost |
|------|------|
| Yahoo Finance / Google Finance | $0 |
| Reddit r/wallstreetbets | $0 |
| Twitter financial commentary | $0 |
| Discord trading groups | $0 to $100/month |
| TradingView paid tier | $15–$60/month |
| Robinhood Gold (Level 2 quotes) | $5/month |

**The retail trader vs the firm trading against them**: $60/year vs $50M+/year on data alone. **A 1,000,000× gap.**

---

## 5 · The speed product

The HFT industry produces a substance called *microseconds*. Their entire reinvestment loop converts revenue into compressed time, then compressed time into more revenue.

### The latency curve (NY → Chicago, round-trip, fastest commercial link)

| Year | Latency | Technology |
|------|---------|------------|
| 2010 | ~16 ms | Spread Networks fiber |
| 2012 | ~13 ms | Tradeworx microwave |
| 2015 | ~8 ms | Maxed microwave |
| 2020 | ~7 ms | Maxed microwave + laser |
| 2024 | **~6.5 ms** | Maxed microwave + laser + atmospheric optimization |

### The cost of one microsecond
- McKay Brothers subscription for top-tier microwave link: ~$1M+/yr (`[VERIFY]` exact range).
- A single microsecond improvement in NY-Chicago latency has been estimated to be worth **millions of dollars per year** in additional captured arbitrage. Source: Aquilina-Budish-O'Neill (QJE 2022); industry coverage.

### A canonical quote
*"We sell microseconds."* — paraphrased from various HFT exec interviews; the exact attribution worth pulling. Brad Katsuyama (IEX founder) talks about it. Michael Lewis's *Flash Boys* (2014) is the canonical popular text.

The retail trader cannot buy a microsecond. The retail trader has no surface on which to spend money to be faster. The arms race is open to one side only.

---

## 6 · The compute-per-trader ratio

If Jane Street has ~3,000 employees and the rumored "thousands to tens of thousands" of H100s by end 2024:

- Conservative: 3,000 H100s ÷ 3,000 employees = **1 H100 per employee**.
- Aggressive: 30,000 H100s ÷ 3,000 employees = **10 H100s per employee**.

Each H100 cost ~$25–40K. The compute-per-employee ratio at Jane Street is therefore **$25K to $400K per worker, just in raw GPU hardware**. That excludes the data center, the networking, the cooling, the engineers.

A retail trader's setup: a laptop. The H100 alone is 100–1000× the laptop in raw compute.

### The dream ratio for the article
"Jane Street has approximately one H100 per employee. NVIDIA produced ~3 million H100s in 2023–2024. Jane Street's fleet alone is **larger than the GPU compute available to most sovereign AI initiatives**. They use it to trade against retail."

`[VERIFY]` exact Jane Street GPU count before publishing this claim.

---

## 7 · The asymmetry that decides the page

**Frame**: it is not that markets are unfair. Markets are *unfair in a measurable way*.

For every dollar a retail trader spends on equipment and information, the firm trading against them spends **a million**. For every hour a retail trader spends researching a position, the firm trading against them spends **ten thousand PhD-hours**. For every microsecond the retail trader cannot perceive, the firm extracting from them has spent millions to control.

A market is supposed to be where buyers and sellers meet to discover a price. In this market, one side is a retail trader with a laptop and a Discord channel. The other side is a building in Lower Manhattan with three thousand PhDs and ten thousand GPUs whose only purpose is to read the laptop's order before it touches the book.

This is not a market. This is a sampling apparatus.

---

## 8 · Source bibliography

### Compute / GPU fleets
- Bloomberg coverage 2023–2024 on Jane Street and Citadel GPU procurement
- The Information 2024 reporting on quant-fund AI infrastructure
- NVIDIA datacenter sales disclosures (10-Q)
- WSJ "Wall Street's AI Arms Race" recurring coverage

### Compensation
- WSJ "Quants on Fire" / "The $1m-a-year fresh PhD" Sept 2024
- eFinancialCareers compensation data
- Wall Street Oasis (WSO) compensation database
- Levels.fyi for FAANG comparison
- US Census, BLS for median wage anchors

### Latency
- McKay Brothers, Quincy Data, Anova marketing materials
- Aquilina-Budish-O'Neill (QJE 2022)
- Michael Lewis, *Flash Boys* (2014)
- Brad Katsuyama interviews (Bloomberg, Odd Lots)

### Data spend
- Neudata / Eagle Alpha alt-data industry reports
- Various coverage of Citadel's data budget
- Bloomberg LP terminal pricing publicly disclosed

---

## 9 · What's missing / `[VERIFY]` debt

1. Exact Jane Street GPU count. Currently a range.
2. Exact Citadel hedge fund annual data spend. Currently "~$200M" per coverage.
3. Median Robinhood funded-account balance — historical estimates range from $240 to $5,000 depending on year and definition. Pull from Q4 2024 8-K.
4. McKay Brothers per-subscriber pricing — never publicly confirmed; industry estimates only.

---

## 10 · The headline I'd lead with

If forced to pick one frame, it's the compute-per-counterparty one:

> *Jane Street pays each of its three thousand employees roughly a million dollars a year. There are ten thousand retail accounts for every Jane Street employee. The math is unavoidable: every retail account exists, on net, to pay one hundred dollars a year toward a PhD's salary at the firm trading against it. The line between a customer and a feedstock is the line that this number erases.*

---

End of file.
