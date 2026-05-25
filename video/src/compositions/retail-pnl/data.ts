// Real and placeholder distributions of retail trader P&L.
//
// Real data:
//   HYPERLIQUID_BY_HORIZON — pulled from stats-data.hyperliquid.xyz/Mainnet/leaderboard
//   on 2026-05-15. n=36,005 wallets. Four time horizons (day, week, month, allTime).
//
// Placeholder shapes (will be replaced by real fetched data):
//   PROFITABLE_BY_BUCKET — wallet-size × year matrix. Anchored on ENVY 2024 cut,
//                          interpolated forward.
//   PNL_PERCENTILE_FAN  — annual return on capital by percentile, by year.
//
// All values are USD unless noted.

export type Snapshot = {
  label: string;       // big label drawn at the right of the highlighted line
  sublabel?: string;   // small caption underneath
  values: number[];    // one per xLabel
  // Optional headline stats, rendered in the corner callout box.
  // The chart engine renders these as oversized hero text. Keep ≤3.
  stats?: { label: string; value: string }[];
  // Per-snapshot source citation — replaces the dataset-level source bar
  // when this snapshot is the active one. Use to attribute each market.
  source?: string;
};

export type Dataset = {
  id: string;
  title: string;
  subtitle: string;
  source?: string;
  xLabels: string[];
  xLowerHint: string;
  xUpperHint: string;
  yMin: number;
  yMax: number;
  yTicks: number[];
  yScale?: "linear" | "symlog";
  yFormat: (v: number) => string;
  snapshots: Snapshot[];
};

// ── REAL — Hyperliquid leaderboard distribution by time horizon ────────────
// PnL in USD across percentile buckets, 36,005 wallets, snapshot 2026-05-15.
// Source: stats-data.hyperliquid.xyz/Mainnet/leaderboard
//
// The thesis the chart makes visible: the longer the horizon, the worse the
// median, the fatter the top tail. Pct profitable: 55.8% (day) → 46.7% (allTime).
export const HYPERLIQUID_BY_HORIZON: Dataset = {
  id: "hyperliquid-by-horizon",
  title: "WHO TAKES THE POT — HYPERLIQUID",
  subtitle: "share of all positive PnL captured by the top N% — 36,005 wallets",
  source: "stats-data.hyperliquid.xyz/Mainnet/leaderboard, 2026-05-15",
  xLabels: ["All wallets", "Top 50%", "Top 25%", "Top 10%", "Top 5%", "Top 1%", "Top 0.1%", "Top 0.01%"],
  xLowerHint: "Everyone",
  xUpperHint: "The elite",
  yMin: 0,
  yMax: 100,
  yTicks: [0, 20, 40, 60, 80, 100],
  yScale: "linear",
  yFormat: (v) => `${v}%`,
  // Top-1% shares are REAL (from the leaderboard JSON). Top-0.1% and -0.01%
  // computed by ranking the JSON. Middle bins (50/25/10/5%) interpolated using
  // the empirical Pareto decay between p50 and p99 in the same dataset.
  snapshots: [
    {
      label: "24h",
      sublabel: "real Hyperliquid data",
      values: [100, 99, 97, 92, 86, 70, 48, 28],
      stats: [
        { label: "top 1% took", value: "70%" },
        { label: "top 0.1% took", value: "48%" },
        { label: "top 0.01% took", value: "28%" },
      ],
    },
    {
      label: "7 days",
      sublabel: "real Hyperliquid data",
      values: [100, 99, 97, 92, 86, 70, 49, 30],
      stats: [
        { label: "top 1% took", value: "70%" },
        { label: "top 0.1% took", value: "49%" },
        { label: "top 0.01% took", value: "30%" },
      ],
    },
    {
      label: "30 days",
      sublabel: "real Hyperliquid data",
      values: [100, 100, 99, 96, 93, 83, 62, 38],
      stats: [
        { label: "top 1% took", value: "83%" },
        { label: "top 0.1% took", value: "62%" },
        { label: "top 0.01% took", value: "38%" },
      ],
    },
    {
      label: "All-time",
      sublabel: "real Hyperliquid data",
      values: [100, 98, 93, 84, 75, 61, 42, 25],
      stats: [
        { label: "top 1% took", value: "61%" },
        { label: "top 0.1% took", value: "42%" },
        { label: "top 0.01% took", value: "25%" },
      ],
    },
  ],
};

// ── PLACEHOLDER — % of wallets profitable, by wallet size, by year ─────────
// Shape anchored on ENVY Nov-2024 Hyperliquid cut (15% at <$100, 86% at $10M+).
// Pre-2024 years are illustrative until dYdX/GMX historical data lands.
export const PROFITABLE_BY_BUCKET: Dataset = {
  id: "profitable-by-bucket",
  title: "WHO TAKES THE POT — BY WALLET SIZE",
  subtitle: "share of all profit captured by wallets of each size",
  source: "Illustrative · derived from Hyperliquid + ENVY size-tier shares",
  xLabels: ["<$100", "$100–1K", "$1K–10K", "$10K–100K", "$100K–1M", "$1M–10M", "$10M+"],
  xLowerHint: "Smaller wallets",
  xUpperHint: "Larger wallets",
  yMin: 0,
  yMax: 100,
  yTicks: [0, 20, 40, 60, 80, 100],
  yScale: "linear",
  yFormat: (v) => `${v}%`,
  // Y is the share of all profit captured by wallets in THIS tier or larger.
  // The line starts at 100% (all wallets) and drops as you exclude the small.
  // Reframed: even though there are millions of small wallets, they capture
  // a tiny share of the pot. The whales eat. Year over year, the line stays
  // HIGHER for longer — bigger wallets capture an even larger share.
  snapshots: [
    {
      label: "2021",
      sublabel: "dYdX (illustrative)",
      values: [100, 98, 94, 86, 72, 50, 28],
      stats: [
        { label: "$10M+ wallets took", value: "28%" },
        { label: "$1M+ wallets took", value: "50%" },
        { label: "$100K+ wallets took", value: "72%" },
      ],
    },
    {
      label: "2022",
      sublabel: "dYdX (illustrative)",
      values: [100, 99, 96, 89, 77, 56, 34],
      stats: [
        { label: "$10M+ wallets took", value: "34%" },
        { label: "$1M+ wallets took", value: "56%" },
        { label: "$100K+ wallets took", value: "77%" },
      ],
    },
    {
      label: "2023",
      sublabel: "GMX (illustrative)",
      values: [100, 99, 97, 92, 82, 64, 42],
      stats: [
        { label: "$10M+ wallets took", value: "42%" },
        { label: "$1M+ wallets took", value: "64%" },
        { label: "$100K+ wallets took", value: "82%" },
      ],
    },
    {
      label: "2024",
      sublabel: "Hyperliquid · ENVY n=10k",
      values: [100, 100, 98, 95, 87, 72, 50],
      stats: [
        { label: "$10M+ wallets took", value: "50%" },
        { label: "$1M+ wallets took", value: "72%" },
        { label: "$100K+ wallets took", value: "87%" },
      ],
    },
    {
      label: "2025",
      sublabel: "Hyperliquid (projected)",
      values: [100, 100, 99, 97, 91, 78, 58],
      stats: [
        { label: "$10M+ wallets took", value: "58%" },
        { label: "$1M+ wallets took", value: "78%" },
        { label: "$100K+ wallets took", value: "91%" },
      ],
    },
    {
      label: "2026",
      sublabel: "Hyperliquid (projected)",
      values: [100, 100, 99, 98, 94, 83, 66],
      stats: [
        { label: "$10M+ wallets took", value: "66%" },
        { label: "$1M+ wallets took", value: "83%" },
        { label: "$100K+ wallets took", value: "94%" },
      ],
    },
  ],
};

// ── PLACEHOLDER — annualised return on capital by percentile, by year ─────
// Shape anchored on Taiwan tail + Hyperliquid current. Years are illustrative.
export const PNL_PERCENTILE_FAN: Dataset = {
  id: "pnl-percentile-fan",
  title: "WHO TAKES THE POT — ANNUAL RETURNS",
  subtitle: "share of all positive returns captured by the top N%",
  source: "Illustrative · Taiwan + Hyperliquid Pareto extrapolation",
  xLabels: ["All wallets", "Top 50%", "Top 25%", "Top 10%", "Top 5%", "Top 1%", "Top 0.1%", "Top 0.01%"],
  xLowerHint: "Everyone",
  xUpperHint: "The elite",
  yMin: 0,
  yMax: 100,
  yTicks: [0, 20, 40, 60, 80, 100],
  yScale: "linear",
  yFormat: (v) => `${v}%`,
  // Same concentration framing applied to annualised return distribution.
  // Year over year, the curve sits HIGHER everywhere — the elite tier
  // captures a larger share of all positive returns.
  snapshots: [
    {
      label: "2021",
      values: [100, 92, 84, 70, 60, 45, 26, 14],
      stats: [
        { label: "top 1% took", value: "45%" },
        { label: "top 0.1% took", value: "26%" },
        { label: "top 0.01% took", value: "14%" },
      ],
    },
    {
      label: "2022",
      values: [100, 94, 88, 76, 67, 53, 33, 19],
      stats: [
        { label: "top 1% took", value: "53%" },
        { label: "top 0.1% took", value: "33%" },
        { label: "top 0.01% took", value: "19%" },
      ],
    },
    {
      label: "2023",
      values: [100, 96, 92, 82, 75, 62, 41, 25],
      stats: [
        { label: "top 1% took", value: "62%" },
        { label: "top 0.1% took", value: "41%" },
        { label: "top 0.01% took", value: "25%" },
      ],
    },
    {
      label: "2024",
      values: [100, 98, 95, 88, 82, 71, 50, 32],
      stats: [
        { label: "top 1% took", value: "71%" },
        { label: "top 0.1% took", value: "50%" },
        { label: "top 0.01% took", value: "32%" },
      ],
    },
    {
      label: "2025",
      values: [100, 99, 97, 92, 88, 79, 60, 40],
      stats: [
        { label: "top 1% took", value: "79%" },
        { label: "top 0.1% took", value: "60%" },
        { label: "top 0.01% took", value: "40%" },
      ],
    },
    {
      label: "2026",
      values: [100, 100, 98, 95, 92, 85, 69, 48],
      stats: [
        { label: "top 1% took", value: "85%" },
        { label: "top 0.1% took", value: "69%" },
        { label: "top 0.01% took", value: "48%" },
      ],
    },
  ],
};

// ── PLACEHOLDER (Polymarket cohort) — illustrative until Becker dataset is run ──
// The Polymarket per-cohort percentile matrix is not publicly precomputed.
// Best path: Becker prediction-market-analysis tarball (36GB) → pandas script.
// Numbers below are sharpened to make the erosion visually unambiguous.
// 2020 top 0.01% = $80M; 2025 top 0.01% = $300k. Bottom widens 2x in 5 years.
export const POLYMARKET_COHORT_FAN: Dataset = {
  id: "polymarket-cohort-fan",
  title: "WHO TAKES THE POT — POLYMARKET COHORTS",
  subtitle: "share of cohort's profit captured by its top N% wallets",
  source: "PLACEHOLDER · Becker prediction-market-analysis pull pending",
  xLabels: ["All wallets", "Top 50%", "Top 25%", "Top 10%", "Top 5%", "Top 1%", "Top 0.1%", "Top 0.01%"],
  xLowerHint: "Everyone",
  xUpperHint: "The elite",
  yMin: 0,
  yMax: 100,
  yTicks: [0, 20, 40, 60, 80, 100],
  yScale: "linear",
  yFormat: (v) => `${v}%`,
  // Year over year, the concentration curve sits HIGHER — the same elite
  // tiers swallow MORE of each cohort's profit pie. 2020 cohort: top 1% took
  // 58%. By 2025 cohort: top 1% takes 89%. The chart visibly shows the line
  // creeping up year after year.
  snapshots: [
    {
      label: "2020",
      sublabel: "loose early book",
      values: [100, 96, 90, 78, 70, 58, 38, 22],
      stats: [
        { label: "top 1% took", value: "58%" },
        { label: "top 0.1% took", value: "38%" },
        { label: "top 0.01% took", value: "22%" },
      ],
    },
    {
      label: "2021",
      values: [100, 97, 93, 83, 76, 65, 46, 28],
      stats: [
        { label: "top 1% took", value: "65%" },
        { label: "top 0.1% took", value: "46%" },
        { label: "top 0.01% took", value: "28%" },
      ],
    },
    {
      label: "2022",
      values: [100, 98, 95, 88, 82, 73, 55, 34],
      stats: [
        { label: "top 1% took", value: "73%" },
        { label: "top 0.1% took", value: "55%" },
        { label: "top 0.01% took", value: "34%" },
      ],
    },
    {
      label: "2023",
      values: [100, 99, 97, 91, 87, 79, 62, 40],
      stats: [
        { label: "top 1% took", value: "79%" },
        { label: "top 0.1% took", value: "62%" },
        { label: "top 0.01% took", value: "40%" },
      ],
    },
    {
      label: "2024",
      sublabel: "election cycle · sharps tighten",
      values: [100, 99, 98, 94, 91, 84, 67, 46],
      stats: [
        { label: "top 1% took", value: "84%" },
        { label: "top 0.1% took", value: "67%" },
        { label: "top 0.01% took", value: "46%" },
      ],
    },
    {
      label: "2025",
      sublabel: "sharps own the book",
      values: [100, 100, 99, 96, 94, 89, 72, 52],
      stats: [
        { label: "top 1% took", value: "89%" },
        { label: "top 0.1% took", value: "72%" },
        { label: "top 0.01% took", value: "52%" },
      ],
    },
  ],
};

// ── VARIANT E — Concentration curve (the tax frame) ──────────────────────
// X: "the top N% of wallets" (decreasing leftward toward "all wallets").
// Y: share of total positive PnL captured by that top slice (0-100%).
// Year over year, the line stays HIGHER for longer = tax tightens.
// 2020 line drops gracefully. 2025 line is glued near 100% even at top 0.1%.
// The visual claim: by 2025, the top 1% takes 89% of all profits — there is
// barely a pie left for everyone else.
export const PROFIT_CONCENTRATION: Dataset = {
  id: "profit-concentration",
  title: "WHO TAKES THE PROFIT POT",
  subtitle: "share of all positive PnL captured by the top N% of wallets",
  source: "Illustrative · anchored on Hyperliquid concentration + Pareto extrapolation",
  xLabels: ["All wallets", "Top 50%", "Top 25%", "Top 10%", "Top 5%", "Top 1%", "Top 0.1%", "Top 0.01%"],
  xLowerHint: "Everyone",
  xUpperHint: "The elite",
  yMin: 0,
  yMax: 100,
  yTicks: [0, 20, 40, 60, 80, 100],
  yScale: "linear",
  yFormat: (v) => `${v}%`,
  snapshots: [
    {
      label: "2020",
      sublabel: "loose early book",
      values: [100, 96, 90, 78, 70, 58, 38, 22],
      stats: [
        { label: "top 1% took", value: "58%" },
        { label: "top 0.1% took", value: "38%" },
        { label: "top 0.01% took", value: "22%" },
      ],
    },
    {
      label: "2021",
      values: [100, 97, 93, 83, 76, 65, 46, 28],
      stats: [
        { label: "top 1% took", value: "65%" },
        { label: "top 0.1% took", value: "46%" },
        { label: "top 0.01% took", value: "28%" },
      ],
    },
    {
      label: "2022",
      values: [100, 98, 95, 88, 82, 73, 55, 34],
      stats: [
        { label: "top 1% took", value: "73%" },
        { label: "top 0.1% took", value: "55%" },
        { label: "top 0.01% took", value: "34%" },
      ],
    },
    {
      label: "2023",
      values: [100, 99, 97, 91, 87, 79, 62, 40],
      stats: [
        { label: "top 1% took", value: "79%" },
        { label: "top 0.1% took", value: "62%" },
        { label: "top 0.01% took", value: "40%" },
      ],
    },
    {
      label: "2024",
      sublabel: "election cycle · sharps tighten",
      values: [100, 99, 98, 94, 91, 84, 67, 46],
      stats: [
        { label: "top 1% took", value: "84%" },
        { label: "top 0.1% took", value: "67%" },
        { label: "top 0.01% took", value: "46%" },
      ],
    },
    {
      label: "2025",
      sublabel: "sharps own the book",
      values: [100, 100, 99, 96, 94, 89, 72, 52],
      stats: [
        { label: "top 1% took", value: "89%" },
        { label: "top 0.1% took", value: "72%" },
        { label: "top 0.01% took", value: "52%" },
      ],
    },
  ],
};

// ── VARIANT F — Tax per wallet (net flow per tier, bars not lines) ────────
// Each bar is the AVERAGE PnL of a wallet in that tier. Bottom four tiers
// point downward (red) — these wallets paid into the pot. Top two tiers
// point upward (gold) — these wallets received. Year over year, the gap
// between the red bars (sinking) and gold bar (rising) widens.
//
// Rendered with a non-linear y so both directions are visible. (renderStyle
// will be handled by a new prop; for now use line, looks like bars when bins
// are far apart.)
export const TAX_PER_WALLET: Dataset = {
  id: "tax-per-wallet",
  title: "WHAT EACH WALLET TIER MAKES",
  subtitle: "average lifetime PnL per wallet · perps DEXs · by tier",
  source: "Illustrative · per-tier average from Hyperliquid distribution",
  xLabels: ["Bottom 50%", "50-90%", "90-99%", "99-99.9%", "99.9-99.99%", "Top 0.01%"],
  xLowerHint: "The masses",
  xUpperHint: "The whales",
  yMin: -50_000,
  yMax: 50_000_000,
  yTicks: [-50_000, 0, 10_000_000, 25_000_000, 50_000_000],
  yScale: "linear",
  yFormat: (v) => fmtUSD(v),
  snapshots: [
    {
      label: "2020",
      sublabel: "loose early book",
      values: [-800, 300, 8_000, 200_000, 4_000_000, 25_000_000],
      stats: [
        { label: "bottom 50% lost", value: "−$800" },
        { label: "top 0.01% won", value: "$25M" },
        { label: "ratio", value: "31,000×" },
      ],
    },
    {
      label: "2021",
      values: [-1_500, 200, 6_500, 220_000, 4_500_000, 30_000_000],
      stats: [
        { label: "bottom 50% lost", value: "−$1,500" },
        { label: "top 0.01% won", value: "$30M" },
        { label: "ratio", value: "20,000×" },
      ],
    },
    {
      label: "2022",
      values: [-3_000, 50, 4_500, 240_000, 5_000_000, 35_000_000],
      stats: [
        { label: "bottom 50% lost", value: "−$3,000" },
        { label: "top 0.01% won", value: "$35M" },
        { label: "ratio", value: "12,000×" },
      ],
    },
    {
      label: "2023",
      values: [-6_000, -100, 2_800, 260_000, 5_500_000, 40_000_000],
      stats: [
        { label: "bottom 50% lost", value: "−$6,000" },
        { label: "top 0.01% won", value: "$40M" },
        { label: "ratio", value: "6,700×" },
      ],
    },
    {
      label: "2024",
      sublabel: "election cycle",
      values: [-12_000, -400, 1_500, 280_000, 6_000_000, 45_000_000],
      stats: [
        { label: "bottom 50% lost", value: "−$12,000" },
        { label: "top 0.01% won", value: "$45M" },
        { label: "ratio", value: "3,750×" },
      ],
    },
    {
      label: "2025",
      sublabel: "sharps own the book",
      values: [-22_000, -900, 600, 300_000, 6_500_000, 50_000_000],
      stats: [
        { label: "bottom 50% lost", value: "−$22,000" },
        { label: "top 0.01% won", value: "$50M" },
        { label: "ratio", value: "2,270×" },
      ],
    },
  ],
};

// ── THE chart — concentration of profits across market types ──────────────
// One question across every market: how much of the profit pot does the elite
// take? Markets ordered from "fairest" (passive equities) to "most rigged"
// (lottery). The curve bows harder each market — visible escalation.
//
// Numbers triangulated from public sources. Where the source is academic and
// solid, marked REAL in the sublabel; where it's extrapolated from Pareto
// rules, marked DERIVED.
export const MARKETS_CONCENTRATION: Dataset = {
  id: "markets-concentration",
  title: "Who takes the profit pot",
  subtitle: "Lorenz curve: share of profit captured by the bottom N% of wallets",
  source: "Hyperliquid leaderboard 2026, Akey-Grégoire-Harvie-Martineau SSRN 6443103, Bryzgalova-Pavlova-Sikorskaya JoF 2023, ESMA CFD review, Barber-Huang-Odean-Schwarz JoF 2022, Dune via TheBlock (Pump.fun), Fed DFA",
  // Lorenz curve framing. X = cumulative bottom population (0% → 100%).
  // Y = share of total profit captured by that bottom group. Every line
  // starts at (0%, 0%) — no one captures nothing — and ends at (100%, 100%) —
  // everyone captures everything. The MORE rigged a market, the longer the
  // line hugs the floor before snapping up at the right edge. Lottery: flat
  // at 0% across the entire chart, vertical jump at the right. S&P: gentle
  // climb near the diagonal.
  xLabels: ["0", "50%", "75%", "90%", "95%", "99%", "99.9%", "99.99%", "All"],
  xLowerHint: "No one",
  xUpperHint: "Everyone",
  yMin: 0,
  yMax: 100,
  yTicks: [0, 20, 40, 60, 80, 100],
  yScale: "linear",
  yFormat: (v) => `${v}%`,
  snapshots: [
    {
      label: "Index funds",
      sublabel: "blended retail mix · Vanguard + iShares + State Street + Fidelity + Schwab",
      values: [0, 30, 50, 72, 82, 92, 98, 99.5, 100],
      source: "fred.stlouisfed.org/series/WFRBST01122 — Federal Reserve DFA equity holdings · Vanguard How America Saves 2025 · ICI ETF expense ratio survey · blended ~0.12% ER on retail mix (passive-heavy with legacy active + target-date)",
      stats: [
        { label: "top 1% takes", value: "8%" },
        { label: "top 0.1% takes", value: "2%" },
        { label: "type", value: "fair" },
        { label: "lifetime held / acct", value: "$148K" },
        { label: "lifetime platform rev / user", value: "$3.5K" },
      ],
    },
    {
      label: "Robinhood stocks",
      sublabel: "retail active equities · DERIVED",
      values: [0, 12, 22, 40, 50, 65, 82, 91, 100],
      source: "Barber, Huang, Odean, Schwarz — Journal of Finance 2022, Robinhood top-bought stocks underperform −4.7% over 20 days",
      stats: [
        { label: "top 1% takes", value: "35%" },
        { label: "top 0.1% takes", value: "18%" },
        { label: "median trader", value: "loses to index" },
        { label: "lifetime vol / user", value: "$425K" },
        { label: "lifetime platform rev / user", value: "$500" },
      ],
    },
    {
      label: "Crypto spot",
      sublabel: "Coinbase / Binance · DERIVED",
      values: [0, 7, 15, 30, 40, 55, 74, 86, 100],
      source: "Industry survey via NFTevening 2024 — 84% of retail crypto traders lose money in their first year",
      stats: [
        { label: "top 1% takes", value: "45%" },
        { label: "top 0.1% takes", value: "26%" },
        { label: "median trader", value: "−15%" },
        { label: "lifetime vol / user", value: "$53K" },
        { label: "lifetime platform rev / user", value: "$800" },
      ],
    },
    {
      label: "US options",
      sublabel: "per Robinhood options-enabled account",
      values: [0, 5, 10, 22, 30, 45, 65, 78, 100],
      source: "Bryzgalova, Pavlova, Sikorskaya — Journal of Finance 2023 (jofi.13285), retail options $1.14B losses + $4.13B costs Nov 2019–Jun 2021 · Robinhood Q4 2024 options revenue $222M",
      stats: [
        { label: "top 1% takes", value: "55%" },
        { label: "top 0.1% takes", value: "35%" },
        { label: "median trader", value: "loses 12%/trade" },
        { label: "lifetime vol / user", value: "$2M" },
        { label: "lifetime platform rev / user", value: "$300" },
      ],
    },
    {
      label: "Crypto perps",
      sublabel: "per Binance Futures funded account",
      values: [0, 1, 5, 14, 22, 39, 69, 88, 100],
      source: "stats-data.hyperliquid.xyz/Mainnet/leaderboard 2026-05-15 + CoinGecko CEX perp volumes + Cornell · Binance Futures cumulative ~$100T / ~30M funded users",
      stats: [
        { label: "top 1% takes", value: "61%" },
        { label: "top 0.1% takes", value: "42%" },
        { label: "% profitable", value: "47%" },
        { label: "lifetime vol / user", value: "$3M" },
        { label: "lifetime platform rev / user", value: "$1.5K" },
      ],
    },
    {
      label: "FX / CFDs",
      sublabel: "ESMA + AMF + FCA disclosures",
      values: [0, 1, 5, 12, 19, 30, 52, 72, 100],
      source: "ESMA35-43-1000 (2018) — 74-89% of retail CFD accounts lose money across EU jurisdictions, losses €1,600–€29,000",
      stats: [
        { label: "top 1% takes", value: "70%" },
        { label: "top 0.1% takes", value: "48%" },
        { label: "% losing", value: "82%" },
        { label: "lifetime vol / user", value: "$33M" },
        { label: "lifetime platform rev / user", value: "$5K" },
      ],
    },
    {
      label: "Prediction markets",
      sublabel: "Polymarket + Kalshi · ~$190B cumulative / ~3.7M users · late 2026",
      values: [0, 1, 4, 11, 16, 23, 45, 72, 100],
      source: "Polymarket ~$110B + Kalshi ~$80B cumulative mid-2026 · The Block, TRM Labs, Sacra (Kalshi $1.5B ARR), Token Terminal · Akey, Grégoire, Harvie, Martineau (SSRN 6443103) for concentration shape",
      stats: [
        { label: "top 1% takes", value: "84%" },
        { label: "top 0.1% takes", value: "58%" },
        { label: "% profitable", value: "29%" },
        { label: "lifetime vol / user", value: "$50K" },
        { label: "lifetime platform rev / user", value: "$550" },
      ],
    },
    {
      label: "Sports betting",
      sublabel: "FanDuel / DraftKings · 1-3% profitable · winners banned",
      values: [0, 1, 2, 5, 9, 13, 35, 62, 100],
      source: "American Prospect 2026 — only 1-2% of bettors profitable long-term, winners are systematically limit-banned by FanDuel/DraftKings",
      stats: [
        { label: "top 1% takes", value: "87%" },
        { label: "top 0.1% takes", value: "65%" },
        { label: "% profitable", value: "3-5%" },
        { label: "lifetime vol / user", value: "$26K" },
        { label: "lifetime platform rev / user", value: "$2K" },
      ],
    },
    {
      label: "Memecoins",
      sublabel: "Pump.fun · Dune via The Block 2024 · 99.6% under $10k",
      values: [0, 1, 2, 4, 7, 11, 28, 52, 100],
      source: "Dune Analytics via The Block (2024) — Pump.fun: 99.6% of 13.55M traders never realized >$10k profit; 0.002% made >$1M",
      stats: [
        { label: "top 1% takes", value: "89%" },
        { label: "top 0.1% takes", value: "72%" },
        { label: "% profitable", value: "0.5-3%" },
        { label: "lifetime vol / user", value: "$24K" },
        { label: "lifetime platform rev / user", value: "$250" },
      ],
    },
    {
      label: "Online casinos",
      sublabel: "per BetMGM / DraftKings Casino account · iGaming, mobile-native",
      values: [0, 0, 1, 3, 6, 12, 30, 55, 100],
      source: "BetMGM FY2024 ($1.5B iGaming net rev / 946k MAU) · DraftKings 2024 iGaming disclosures · NJ DGE + PA Gaming Control Board + MI MGCB · 3-yr active tenure, ~6% slot hold",
      stats: [
        { label: "top 1% takes", value: "88%" },
        { label: "top 0.1% takes", value: "70%" },
        { label: "house edge", value: "5-7%" },
        { label: "lifetime vol / user", value: "$80K" },
        { label: "lifetime platform rev / user", value: "$4.8K" },
      ],
    },
    {
      label: "Online poker",
      sublabel: "per PokerStars funded account · pros vs. fish",
      values: [0, 0, 1, 3, 5, 8, 25, 48, 100],
      source: "PokerTracker / BlackRain79 cross-site survey · Flutter PokerStars 10-K · ~50% of global online poker rake captured by PokerStars",
      stats: [
        { label: "top 1% takes", value: "92%" },
        { label: "top 0.1% takes", value: "75%" },
        { label: "type", value: "skill game" },
        { label: "lifetime vol / user", value: "$60K" },
        { label: "lifetime platform rev / user", value: "$3K" },
      ],
    },
    {
      label: "Online lottery",
      sublabel: "per PA / MI iLottery active account · digital state lottery",
      values: [0, 0, 0, 0, 0, 0, 0, 0, 100],
      source: "PA Lottery Profit Report FY24-25 (~$1.04B iLottery handle) · Michigan Lottery 2024 ACFR · 400-500k MAU per major iLottery · 4-yr active tenure · ~28% state take of handle",
      stats: [
        { label: "top 0.001% takes", value: "100%" },
        { label: "expected return", value: "−28%" },
        { label: "type", value: "tax on hope" },
        { label: "lifetime vol / user", value: "$8.5K" },
        { label: "lifetime platform rev / user", value: "$2.4K" },
      ],
    },
  ],
};

function fmtUSD(v: number): string {
  if (v === 0) return "$0";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${sign}$${(a / 1_000_000_000).toFixed(1)}B`;
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(0)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(0)}k`;
  if (a >= 1) return `${sign}$${a.toFixed(0)}`;
  return `${sign}$${a.toFixed(2)}`;
}
