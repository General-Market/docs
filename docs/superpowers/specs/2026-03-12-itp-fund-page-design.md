# ITP Fund Page — BlackRock-Style with Founder & DeFi Analytics

**Date**: 2026-03-12
**Status**: Draft

## Goal

Replace the minimal ITP detail page (`/itp/[itpId]`) with a rich, BlackRock/iShares-inspired fund page. Generic — works for all ~100 planned ITPs. Enriched with founder demographics, DeFi metrics, and funding data derived from existing local datasets.

## Data Sources

| Source | Location | Key Fields |
|--------|----------|------------|
| NAV/AUM/Holdings | data-node `/itp-price`, `/snapshot` | nav, aum, assets[], weights[], prices[] |
| Live NAV series | `useItpNavSeries(itpId, timeframe)` | OHLC data (1D/7D/90D) |
| Metadata | BridgeProxy on-chain | description, websiteUrl, videoUrl |
| Token logos | `frontend/public/coin-map.json` | symbol → coingecko_id → image URL |
| Founders | `_bmad-output/.../crypto_founders_complete.json` | name, age, gender, nationality, university, background, role |
| DeFiLlama protocols | `defillama_protocols` table (data-node DB) | tvl, tvl_change_1d/7d, mcap, category, chains[] |
| DeFiLlama raises | `defillama_raises` table | round, amount_m, valuation_m, lead_investors[] |
| CoinGecko categories | `coingecko_categories` table | category names per coin |

### Joining Holdings → Enrichment

```
ITP holdings (symbol[])
  → coin-map.json (symbol → coingecko_id, image)
  → crypto_founders_complete.json (coingecko_id → founders[], launch_year, ath_*)
  → defillama_protocols (gecko_id → tvl, fees, category)
  → defillama_raises (defillama_id → funding rounds)
```

## Page Structure (Top to Bottom)

### 1. Header
- ITP name, symbol, status badge (active/pending)
- Description (from on-chain metadata)
- Breadcrumbs: Home / Markets / {ITP Name}

### 2. Key Stats Bar (4 cards, horizontal)
- **NAV/Share** — live price, 1D change % with green/red color
- **TVL (AUM)** — total value locked
- **Assets** — number of holdings
- **Since Inception** — return % (NAV now vs $1 at creation)

### 3. Performance Chart
- Line chart showing NAV over time
- Timeframe tabs: 1D | 7D | 90D
- Uses existing `useItpNavSeries` hook
- Tooltip on hover showing date + NAV
- Recharts (already in project dependencies)

### 4. Holdings Table
- Sortable columns: #, Logo, Symbol, Name, Weight%, Price, 24h Change%, Market Cap
- Token logos from coin-map.json CoinGecko CDN URLs
- Row click → could expand for more detail (future)
- Paginated (20 per page) for 100-asset ITPs

### 5. Portfolio Breakdown
- Donut/pie chart showing top 10 holdings by weight + "Other" slice
- Recharts PieChart
- Legend alongside with symbol + weight%

### 6. Concentration Metrics (3 cards)
- Top 5 holdings weight %
- Top 10 holdings weight %
- HHI (Herfindahl-Hirschman Index) — sum of squared weights, shown as score

### 7. Founder Demographics (bar charts section)
- **Age Distribution** — horizontal bars: 20-29, 30-39, 40-49, 50-59, 60+
- **Gender Split** — horizontal bars: Male / Female / Unknown
- **Top Nationalities** — horizontal bars, top 12 countries
- **Top Universities** — horizontal bars, top 10
- **Founder Count** — total founders across all holdings
- Only shows founders where data exists (graceful degradation)
- Note: "Based on {N} founders across {M} portfolio companies"

### 8. DeFi Health (3 cards + table)
- **Aggregate TVL** — sum of all holdings' DeFiLlama TVL
- **Avg TVL Change 7D** — weighted average
- **Protocols with TVL data** — N of M holdings
- Table: Top 10 holdings by TVL with tvl, tvl_change_1d, tvl_change_7d
- Only shows if any holding has DeFiLlama data

### 9. Funding Overview
- **Total Raised** — sum across all holdings' funding rounds
- **Avg Valuation** — average of known valuations
- **Top Investors** — horizontal bar chart of most frequent lead investors across portfolio
- Table: Recent raises with project, round, amount, lead investor, date
- Only shows if any holding has raise data

### 10. Fund Facts
- Creation date
- Chain: Index L3 (Orbit)
- Settlement address (truncated, copy button)
- ITP ID (truncated, copy button)
- Rebalance method: Equal weight / Custom

### 11. Trade CTA
- "Buy this Index" / "Sell" buttons
- Links back to `/#markets` with scroll-to-card anchor

## Technical Architecture

### Data Fetching Strategy

**Server-side (ISR, revalidate 60s):**
- ITP detail (nav, aum, holdings) — existing `getItpDetail()`
- Holdings enrichment — new `getItpHoldingsEnriched()`:
  - Reads `coin-map.json` at build time
  - Reads `crypto_founders_complete.json` at build time
  - Calls data-node for DeFiLlama protocol data (new endpoint or batch query)

**Client-side (real-time):**
- Live NAV via `useItpNav(itpId)`
- NAV chart via `useItpNavSeries(itpId, timeframe)`
- Metadata via `useItpMetadata(itpId)`

### New API Endpoint Needed

`GET /api/itp-enrichment?itp_id={id}` — server route that:
1. Fetches holdings from data-node `/snapshot`
2. Joins with coin-map.json for logos + coingecko_ids
3. Joins with crypto_founders_complete.json for founder data
4. Returns enriched payload (cached 5 min)

DeFiLlama data: either add a data-node endpoint or query directly from frontend API route.

### Component Structure

```
app/[locale]/itp/[itpId]/page.tsx          — Server component (metadata, ISR shell)
components/domain/itp-page/
  ItpPageClient.tsx                         — Client wrapper (live data hooks)
  KeyStatsBar.tsx                           — 4 stat cards
  PerformanceChart.tsx                      — NAV line chart with timeframe tabs
  HoldingsTable.tsx                         — Sortable, paginated holdings
  PortfolioBreakdown.tsx                    — Donut chart
  ConcentrationMetrics.tsx                  — 3 metric cards
  FounderDemographics.tsx                   — 4 bar charts
  DefiHealth.tsx                            — TVL aggregate + table
  FundingOverview.tsx                       — Raises + investor chart
  FundFacts.tsx                             — Key details
  TradeCta.tsx                              — Buy/Sell buttons
```

### Charting

Use Recharts (already installed) for:
- AreaChart (performance)
- PieChart (portfolio breakdown)
- BarChart (founder demographics, investor frequency)

### Styling

BlackRock/iShares institutional style:
- White background, thin borders
- Section headers: uppercase 11px tracking-wider
- Numbers: JetBrains Mono, tabular-nums
- Green/red for positive/negative
- Cards with subtle borders, no shadows
- Consistent with existing design tokens in tailwind config

## Graceful Degradation

Not all ITPs will have full data. Each section checks availability:

| Section | Shows if... |
|---------|------------|
| Performance Chart | NAV series has data points |
| Holdings Table | Always (core data) |
| Portfolio Breakdown | Holdings have weights |
| Founder Demographics | Any holding matches founders JSON |
| DeFi Health | Any holding has DeFiLlama TVL |
| Funding Overview | Any holding has raise data |

Sections with no data are hidden, not shown empty.

## Scope Exclusions

- No star ratings or Morningstar-style scoring (insufficient history)
- No Sharpe/Beta/Alpha (need 1Y+ data)
- No fund manager bio (deployer is an address)
- No dividend/distribution section
- No comparison tool (future)
- Holdings row expansion (future)
