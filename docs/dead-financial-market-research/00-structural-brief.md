# Dead Financial Market Theory — Structural Brief

Sibling to `/anticheat-flags`. Same chassis, opposite axis.

- **/anticheat-flags** is **categorical**: which venue, which mechanism. A wall of evidence sorted by perpetrator.
- **/dead-financial-market** must be **temporal**: which year, what curve. A clock showing the market dying.

The first proves cheating exists. This one proves cheating compounds.

---

## 1 · Voice exemplars from the existing page

The Cioran knife. Pull these as tonal anchors:

- *"The first exchange to publish how rigged this industry is. And the first to fix it."*
- *"Markets get harder each year for retail and small firms to win. Predatory actors reinvest the billions they extract, and extract more."*
- *"Sealed bets. No mempool to sandwich. No validator with a side bet."*
- *"No internal book. The pool is the counterparty."*
- *"No order flow to sell. Bets post directly to the pool."*
- *"One block per minute. There is nothing for the HFT loop to spin against."*
- *"The seal is the cancellation."*
- *"Geography is not an input."*
- *"Large losses are capped per order. A whale cannot pick off the small taker."*
- *"Trades resolve once a minute. A faster feed buys nothing."*

Pattern: a sentence names what the venue does. The next sentence names what we don't. Always two short ones. The second sentence is the knife.

For the new page, every section's chart caption (`generalMarketLabel` equivalent) should follow the same form: *"X is no longer possible because Y."*

---

## 2 · Visual primitives

CSS variables (defined in apple-style-table.md and globals):

- `--apple-text` · primary text
- `--apple-text-secondary` · body copy
- `--apple-text-tertiary` · labels, captions
- `--apple-line` · 1px rules
- `--apple-panel` · pill / card background
- `--apple-accent` · the loss-red (used in ribbon `tone: loss`)
- `--apple-font-display` · SF Pro Display ≥20px
- `--apple-font-text` · SF Pro Text <20px
- `--apple-track-tight` · -0.022em
- `--apple-track-tighter` · -0.024em
- `--apple-r-pill` · 980px
- Content width: **1068px**. Padding: 24px.

Typography:

- **Hero H1**: `clamp(32px, 4.6vw, 56px)`, weight 600, `track-tighter`, line 1.1, `ss01` feature
- **Section H2**: 22px / weight 600 / `track-tight`
- **Venue H2**: `clamp(28px, 3.6vw, 40px)`
- **Body**: 17px / line 1.47 / `track-tight`
- **Caption**: 12px / -0.005em / TERTIARY
- **Hero lead**: 19px / 1.5 / max-width 820
- **Ribbon stat value**: `clamp(20px, 2vw, 24px)` / 600 / `tabular-nums`
- **Ribbon label**: 12px / TERTIARY / margin-top 6

Animation:

- `Reveal` component. Mask reveal on text. Delay 0.04–0.24. Stagger by index.
- Easing: Apple. `cubic-bezier(0.4, 0, 0.6, 1)` default.

---

## 3 · Section inventory of the existing page

1. **HERO** — H1 thesis + 19px lead paragraph. Two paragraphs, no chrome.
2. **VenueBleedSection** — per-venue triple-bar: cumulative bleed at 100 / 1K / 100K trades. Quantitative.
3. **EdgeWaysSection** — 13 mechanisms ranked by amortized bps. Whisker chart.
4. **ColocationSection** — receipts that aren't illegal. The structural-edge gallery.
5. **FeeTierSection** — spread in bps + cost of staying inside the tier.
6. **EdgeMatrixSection** — 12 mechanisms × five categories (information, latency, execution, subsidy, risk).
7. **VENUE PILLS** — anchor nav, matches homepage "See All" pattern.
8. **VENUE SECTIONS** — eleven venues, each: founding year, ribbon stats, indictment paragraph, incident card grid.

Each venue card carries: date, amount, headline, knife, summary, source label + URL, mechanism, chart props.

---

## 4 · Chart pattern — what to reuse and what to invent

**Reuse**: the bps whisker bar (`bpsLow` / `bps` / `bpsHigh`). Strong primitive — the central estimate with the defensible range. Use it wherever a number has a confidence interval.

**Reuse**: the small-multiple bar grid. EdgeMatrixSection's rows-per-topic format.

**Invent for temporal**:

- **ExtractionCurve** — multi-series line chart. X = year (2015 → 2025). Y = log-scale USD. Series = Citadel Sec, Jane Street, Virtu, Hudson River, Wintermute (where disclosed). One chart, five colors, one story: it goes up and right and never bends.
- **DecadeWaterfall** — left side: what extraction looked like in 2015 (MEV = 0, PFOF = $0.2B, Citadel Sec = $1.7B, dark pool share = 35%). Right side: 2025. Bars side-by-side, gap labeled.
- **CompoundingClock** — small ring/dial component per metric. "+ 480%". "+ $14B/yr". "+ 32pp". Just a number with a vector and a year-pair. Twelve of them in a grid. The visual proof of the curve.
- **BotShareDial** — bar showing % of activity from machines vs humans for: NYSE equities, CME futures, Solana DEX, crypto perps. Year by year if data allows.
- **RetailBleedTimeline** — one number per year: % of retail CFD/perp/options accounts losing money. Source: regulator-mandated broker disclosures. Honest line, no bullshit.
- **ReinvestmentLoop** — circular flow diagram. Extraction $ → R&D → faster extraction → more $. Annotated with capex numbers (GPU buys, microwave links, PhD hires).
- **MarketStructureWedge** — stacked area. % of US equity volume by venue type 2015→2025. Lit exchange share shrinks. Dark pool + wholesaler share grows.
- **TenYearsAgoVsNow** — two-column table. Left: market property X in 2015. Right: same in 2025. Same metric, brutally different number. The page's spine.

---

## 5 · The "ribbon stat" format

`{ value: '$9.7B', label: 'Citadel Sec trading revenue, 2023', tone: 'loss' }`

Four examples for the new page:

- `{ value: '+ 480%', label: 'HFT firm revenue, 2015 → 2024', tone: 'loss' }`
- `{ value: '$1.9B', label: 'MEV extracted from Ethereum users since 2020', tone: 'loss' }`
- `{ value: '70 → 85%', label: 'Algo share of US equity volume, 2015 → 2024', tone: 'loss' }`
- `{ value: '$0 → $5B+', label: 'PFOF received by retail brokers per year', tone: 'loss' }`

Every ribbon stat is a *change over time*, not a snapshot. That's the structural difference from anticheat-flags.

---

## 6 · Type definitions for temporal data

```ts
// One time-series entry — used by ExtractionCurve, BotShareDial, RetailBleed.
export interface YearPoint {
  year: number          // 2015 ... 2025
  value: number         // raw value in the topic's unit
  source?: string       // optional per-point source label
  estimated?: boolean   // dashed segment if true
}

// A named series of YearPoints.
export interface TimeSeries {
  slug: string
  label: string         // 'Citadel Securities'
  unit: string          // '$B revenue'
  color?: string        // optional palette override
  points: YearPoint[]
  primarySourceLabel: string
  primarySourceUrl: string
}

// A compounding-clock data row.
export interface DeltaStat {
  slug: string
  metric: string        // 'HFT firm aggregate revenue'
  from: { year: number; value: string }   // '$5.4B'
  to:   { year: number; value: string }   // '$31B'
  change: string        // '+ 480%' or '+ $14B/yr'
  unit: string          // '$ revenue'
  knife: string         // single sentence
  sourceLabel: string
  sourceUrl: string
}

// A then-vs-now table row.
export interface BaselineRow {
  slug: string
  property: string                       // 'MEV extracted per year'
  then: { year: number; value: string; note?: string }
  now:  { year: number; value: string; note?: string }
  knife: string                          // what the gap means
  sourceLabel: string
  sourceUrl: string
}

// An incident with an annual cadence (for the timeline).
export interface YearMilestone {
  year: number
  headline: string                       // '0DTE options launched'
  oneline: string                        // why it matters
  source?: { label: string; url: string }
}

// The reinvestment loop's edges (extraction → reinvestment → more extraction).
export interface LoopNode {
  slug: string
  label: string          // 'Citadel Securities trading revenue, 2023'
  value: string          // '$9.7B'
  sourceLabel: string
  sourceUrl: string
}

export interface LoopEdge {
  from: string           // slug of source node
  to:   string           // slug of destination node
  label: string          // 'reinvested into', 'spent on', 'feeds'
  detail?: string        // additional annotation
}
```

---

## 7 · Proposed page outline

A page that *reads downward like time*. Each section is a year-axis cut.

### HERO
- H1: *The Dead Financial Market Theory.*
- Lead: the brief the user wrote. Verbatim.
- (Optional eyebrow: *Sibling proof to /anticheat-flags*)

### 1. The Curve
A single chart. Multi-series line, 2015 → 2025. Citadel Sec / Jane Street / Virtu / Hudson River / Wintermute net trading revenue. Y-axis is log. One sentence below: *"Five firms. Ten years. None bent."*

### 2. The Reinvestment Loop
A circular diagram. *Extraction → R&D → Latency → Extraction*. Annotated with: GPU procurement orders, microwave-tower capex, PhD salaries, alt-data spend. The loop is the thesis.

### 3. The Compounding Clock
Twelve `DeltaStat` cards in a 3×4 grid. Every card: a metric, a 2015 value, a 2025 value, the % or absolute delta. Each one independently devastating; together they are the curve.

Candidate twelve:
1. HFT firm aggregate revenue
2. MEV extracted per year on Ethereum + L2s
3. PFOF received by US retail brokers
4. % of US equity volume executed off-exchange
5. % of US equity volume from algos
6. Algo share of CME futures
7. Quant pod-shop combined AUM (top 8)
8. 0DTE options daily volume
9. Latency NY → Chicago, fastest commercial link
10. Treasury secondary market PTF share
11. New-grad quant PhD median compensation
12. Number of US public listings

### 4. The Retail Bleed
`RetailBleedTimeline`. % of retail CFD accounts losing money, year by year, 2018 → 2025. ESMA-required disclosures. Add: % of retail perp accounts losing on Hyperliquid / dYdX (per public dashboards). Add: % of 0DTE retail options accounts losing on RH/Schwab studies. Each line independently. No averaging. The trend is the point.

### 5. The Bot Theory
Twin panel.

Left — *the original*: Dead Internet Theory. Imperva Bad Bot Report year-over-year — % of all internet traffic from bots, 2014 → 2025. Cite Atlantic / NYT canon.

Right — *the analogue*: Bot share of market activity. Bars for NYSE algos, CME algos, BIS Triennial FX algo share, MEV bots on Solana sandwich rate, % of crypto CEX volume from MMs vs retail UIs.

One paragraph below mapping the two: bots talking to bots ↔ bots trading with bots. Manufactured engagement ↔ manufactured volume. The few remaining humans are the bait.

### 6. Then vs Now
A two-column table. ~14 `BaselineRow` entries. Each row: property in 2015 vs property in 2025. Examples:

- MEV extracted per year — 2015: $0. 2025: ~$1B+.
- Citadel Sec revenue — 2015: ~$1.7B. 2024: ~$9.7B.
- PFOF received by retail brokers — 2015: ~$0.3B. 2024: ~$3.7B.
- 0DTE share of S&P options — 2015: 5%. 2025: ~50%.
- # of US listed companies — 1996: ~8,000. 2025: ~4,300.
- Latency NY-Chicago (microwave) — 2015: ~8ms. 2025: ~6.5ms.
- US equities off-exchange share — 2015: ~35%. 2025: ~50%+.
- Quant pod-shops top-8 AUM — 2015: ~$200B. 2025: ~$700B+.

The cumulative weight is the argument.

### 7. Regulatory Capture
A short section. Not the centerpiece; the explanation for why the curve never bends.

Three rows in a small grid: lobbying spend (Citadel, Coinbase, SIFMA), revolving-door names, blocked SEC rules (PFOF reform 2022 → killed 2024). Sparse. Bleak.

### 8. The Ten-Years-Ago Restoration
The closer. A list of what General Market builds, mapped one-to-one to properties markets had in 2015 but lost:

- Sealed bets → restores: no mempool to sandwich.
- Parimutuel pools → restores: no MM to internalize against you.
- BLS oracle consensus → restores: no single peek at the tape.
- Blocks per minute → restores: a tape too slow for the HFT loop.
- No leverage → restores: no liquidation cascades to engineer.
- No PFOF surface → restores: nothing to sell to a wholesaler.
- No tier table → restores: one fee, one rate, no insiders.

Format: a small `BeforeAfter` grid. Left column: the lost property. Right column: how we re-establish it.

Final paragraph: short. Two sentences. The knife.

### 9. CTA / Pills
Match the homepage pattern. Pills linking to: /anticheat-flags · /vision · /itp · the litepaper · the case study.

---

## 8 · Research debt — what each section needs

| Section | Data needed | Status |
|---|---|---|
| 1 · The Curve | Yearly revenue 2015–2025 for ≥5 named extractors | OPEN — research file `02-extractor-revenues.md` |
| 2 · Reinvestment Loop | Capex line-items: GPUs, microwave links, PhD salaries, alt-data | OPEN — research file `06-arms-race-and-baseline.md` |
| 3 · Compounding Clock | 12 metrics × 2 years × 1 source each | OPEN — spans all six research files |
| 4 · Retail Bleed | ESMA broker disclosures by year + Robinhood options PnL studies | OPEN — research file `01-retail-pnl-erosion.md` |
| 5 · Bot Theory | Imperva year-by-year + algo share by venue | OPEN — research file `03-bot-share-and-dead-theory.md` |
| 6 · Then vs Now | ~14 baseline rows, each with two sourced values | OPEN — research file `06-arms-race-and-baseline.md` |
| 7 · Regulatory Capture | Lobbying $, revolving doors, killed rules | OPEN — research file `07-regulatory-capture.md` |
| 8 · Restoration | GM product list — already in codebase | DONE — extracted from `data-edge-ways.ts` |

---

## 9 · Restoration map (already extractable from codebase)

Pulled directly from `data-edge-ways.ts` `fix:` fields. These become the closer:

| Property markets had in 2015 | GM mechanism that restores it |
|---|---|
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
| No HFT-spin loop | One rate, everyone. Pool resolves once per round. |
| No last-look reject window | Sealed-bid auction. No rejection step. |
| No leverage cascade | No leverage. No forced liquidation. |

Thirteen mechanisms, thirteen restorations. The closing section writes itself.

---

## 10 · What this page must NOT do

- No "we are the disruptors" rhetoric.
- No appeal to fairness as a moral category. Use *structural* language.
- No charts without a defensible range or source label.
- No round numbers without a citation.
- No prediction about the future. Only the curve so far.
- No emoji, no exclamation, no enthusiasm.
- No reference to General Market until section 8. The piece earns the close.
- No charts where retail is the "underdog." Retail isn't an underdog. Retail is the supply.

---

## 11 · Word and density budget

- Total prose target: ~1,200 words.
- Data points target: 50+ sourced numbers across all sections.
- Charts target: 8 distinct visualizations.
- Every section ends in a one-sentence knife.
- The page should fit eight scrolls on a 16" monitor. No more.

End of brief.
