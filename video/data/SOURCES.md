# Perpetual DEX Trader PnL Distribution — Source Inventory

Investigation: 2026-05-15. Goal: longitudinal trader-percentile P&L for retail
perps DEXs covering as much of 2021-2026 as possible.

## What we got (raw, downloadable, distributional)

### 1. GMX V2 — full per-trader lifetime PnL  [BEST WIN]
- **Source:** GMX synthetics squid (the official subgraph powering stats.gmx.io)
- **Endpoints:**
  - Arbitrum: `https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql`
  - Avalanche: `https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql`
- **Query:** `accountStats(where:{period_eq:"total"})` — paginated 1000 at a time
- **Coverage:** lifetime since GMX V2 deploy (Arbitrum: Aug 2023, Avalanche: Jul 2023) → present
- **Granularity:** every individual address, with realizedPnl, volume, wins, losses, cumsumCollateral, maxCapital, netCapital
- **Files:**
  - `gmx_v2_arbitrum-account-totals.jsonl` — 246,658 accounts, 7.3 MB
  - `gmx_v2_avalanche-account-totals.jsonl` — 10,639 accounts, 3.1 MB
  - `gmx-v2-distribution.json` — computed percentile summary
- **Headline numbers (Arbitrum, all-time):**
  - 60% of traders lose money (40.21% profitable)
  - Median trader PnL: −$0.01
  - p99 PnL: $9,691; p99.9: $154,997; p99.99: $1.55M
  - Top 1% capture **92.25%** of all profits; top 0.1% capture 65.51%
  - Aggregate net trader PnL: −$5.57M (i.e. GLP/GM holders won $5.57M)
- **Daily buckets exist** (`period:"1d"`, ~Jul 2023 onward) but require ~100M-row pull
  to build per-year distributions. Ask if we want it.

### 2. Hyperliquid leaderboard snapshot — full percentile distribution per window
- **Source:** `https://stats-data.hyperliquid.xyz/Mainnet/leaderboard` (official)
- **Snapshot:** 2026-05-15
- **Files:**
  - `hyperliquid-leaderboard-snapshot.json` — raw, 36,005 wallets, 30 MB
  - `hyperliquid-distribution.json` — computed percentiles for `allTime`, `month`, `week`, `day`
  - `_compute_distribution.py` — the script
- **Headline (allTime, n=36,005):**
  - 46.71% profitable
  - Median PnL: −$1,310
  - p99: $6.78M; p99.9: $46.8M; p99.99: $189.9M
  - Top 1% capture **60.93%** of total profits
  - Aggregate net trader PnL: +$10.79B (Hyperliquid is unusual — see methodology caveat below)

## What we found but couldn't pull (longitudinal distribution by year)

### 3. ENVY Protocol — Hyperliquid 30-day cohort study (Nov 2024)
- **URL:** https://medium.com/@envyprotocol/i-analyzed-10-000-hyperliquid-traders-the-results-are-brutal-a29adcca8c2a
- **Sample:** 10,000 random Hyperliquid wallets, 30 days
- **Win-rate by capital cohort** (the closest thing to a Saez chart):
  | Capital | Win rate |
  |---|---|
  | $0–100 | 15.3% |
  | $100–1k | 15.4% |
  | $1k–10k | 17.4% |
  | $100k–1M | 25.7% |
  | $1M–10M | 41.8% |
  | $10M–100M | 85.7% |
- Code/data claimed open on GitHub but link not provided in article.
- **Time series:** single 30-day window only.

### 4. CFTC retail-futures study (Nov 2024)
- **URL:** https://www.cftc.gov/sites/default/files/2024-11/Retail_Traders_Futures_V2_new_ada.pdf
- US futures (CME, not crypto perps), retail PnL distribution by percentile.
- PDF rendering failed via WebFetch — fetch with a real PDF reader to extract.

### 5. coindataschool/GMX (V1 weekly aggregate trader PnL)
- **URL:** https://github.com/coindataschool/GMX
- Notebooks compute weekly aggregate trader PnL on GMX V1 from CSVs named e.g.
  `Traders Net PnL_2021-12-22_2022-09-11.csv` — but the CSVs are NOT committed.
  They were exported from Dune; query IDs not preserved in the notebook.
- Notebook covers Arbitrum 2021-08-31 → 2022-09-11 weekly aggregate trader PnL only.
  Per-trader distribution not present.

## Dune dashboards inspected (no percentile-by-time-period data)

| Dashboard | Protocol | Time | Granularity | CSV? |
|---|---|---|---|---|
| https://dune.com/adamzjw/gmx-trader-leaderboard | GMX | 2024-01 → present | Top 30 traders only | No |
| https://dune.com/adamzjw/gmx-trader-dashboard | GMX | per-trader views | individual lookup | No |
| https://dune.com/dydxanalytics/dydx-unified-dashboard | dYdX | governance/staking only | none | n/a |
| https://dune.com/queries/1168810 | GMX | top traders by PnL | top-N, no percentiles | No |
| https://dune.com/queries/1227065 | GMX | weekly top traders | top-N | No |
| https://dune.com/sealaunch/hyperliquid | Hyperliquid | volume/TVL/revenue, no PnL distribution | none | No |
| https://dune.com/x3research/hyperliquid | Hyperliquid | 4 counter widgets, volume only | none | No |
| https://dune.com/uwusanauwu/perps | 40+ perps | weekly volume only | per-protocol volume | No |
| https://dune.com/KARTOD/drift-or-perpetual-swaps-on-solana | Drift | new/active wallets | none | No |
| https://dune.com/gmx-io/gmx-analytics | GMX (official) | aggregate metrics | none | No |

**No public Dune dashboard publishes (quarter × percentile_bucket × pnl) for any
perps protocol covering 2+ years.** Closest substitute: query the GMX squid
directly with the 1d-bucket period and aggregate yourself.

## Other dead ends

- `stats.gmx.io` — JS-rendered, blocked our fetcher; subgraph is the same data.
- `defillama.com/derivatives` — 403 to bots; free API requires paid plan now.
- The Graph hosted service (`api.thegraph.com/subgraphs/name/...`) — sunset; use
  the Graph gateway with an API key, or chain-native squids.
- dYdX v4 indexer — only exposes per-address `historical-pnl`, no leaderboard
  endpoint. The trade.dydx.exchange rankings page computes client-side.
- Drift `data.api.drift.trade` — root + /leaderboard return 404; no public
  aggregate endpoint found.
- Vertex / Aevo — no public per-trader PnL endpoint surfaced.

## Methodology caveats

- **GMX V2** PnL is "realized" (closed-position) only. Open positions are not
  in the lifetime number. BigInt encoding: USD × 10^30 (squid v2 convention).
- **Hyperliquid leaderboard** is the source for the "top traders" public list —
  it ranks by PnL and includes the very long upper tail (max +$916M, min −$129M).
  Net positive aggregate ($10.79B) reflects the HLP / market-maker P&L going
  into the leaderboard pool, plus survivor bias (only addresses that traded
  enough to register). Treat this as the public-leaderboard distribution, not
  the universe of all Hyperliquid depositors. ENVY's 10k-random-wallets sample
  shows 73.8% losers — closer to the true retail picture.
- **GMX numbers exclude wallets with zero volume** (likely test/airdrop hunters);
  178k of 247k Arbitrum accounts traded.
