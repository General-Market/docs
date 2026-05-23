// Mechanism data mirrored from
// frontend/app/[locale]/(marketing)/anticheat-flags/data-edge-ways.ts.
// Thirteen ways a venue takes a bite, ranked by effective bps per
// round-trip (peak × frequency). One chart per mechanism in the video.

export type Mechanism = {
  slug: string;
  /** Full name, rendered as the chart title. */
  name: string;
  /** Short label rendered under the bar. */
  short: string;
  /** Rank, 1 = worst. */
  rank: number;
  peakBps: number;
  /** 0..1 — share of round-trips the mechanism fires on. */
  frequency: number;
  /** Effective bps = peak × frequency. */
  bps: number;
  /** One-line peak × frequency = effective, for the callout. */
  conversion: string;
  /** The General Market answer. */
  fix: string;
};

// Sorted by effective bps, descending — the order the bar chart draws in.
export const MECHANISMS: Mechanism[] = [
  {
    slug: "jito-mev",
    name: "Jito-bundle MEV",
    short: "MEV",
    rank: 1,
    peakBps: 400,
    frequency: 0.15,
    bps: 60,
    conversion: "400 bps peak × 15% sandwiched = 60 bps a round-trip",
    fix: "Sealed bets. No mempool to sandwich.",
  },
  {
    slug: "pfof",
    name: "PFOF wholesaler markup",
    short: "PFOF",
    rank: 2,
    peakBps: 17,
    frequency: 1.0,
    bps: 17,
    conversion: "17 bps peak × every order sold = 17 bps a round-trip",
    fix: "No order flow to sell. Bets post to the pool.",
  },
  {
    slug: "b-book",
    name: "Internal book",
    short: "B-book",
    rank: 3,
    peakBps: 15,
    frequency: 1.0,
    bps: 15,
    conversion: "15 bps peak × every fill internalized = 15 bps",
    fix: "No internal book. The pool is the counterparty.",
  },
  {
    slug: "vip-fee-tier",
    name: "VIP fee-tier subsidy",
    short: "VIP tier",
    rank: 4,
    peakBps: 11,
    frequency: 1.0,
    bps: 11,
    conversion: "VIP 0 pays 10 bps, VIP 9 pays 2.3 — gap is yours",
    fix: "A single flat fee, one tier for everyone.",
  },
  {
    slug: "order-flow-vis",
    name: "Order-flow visibility",
    short: "Flow view",
    rank: 5,
    peakBps: 2,
    frequency: 1.0,
    bps: 2,
    conversion: "2 bps peak × the book is always visible = 2 bps",
    fix: "Sealed bets. The book is private until resolve.",
  },
  {
    slug: "region-cluster",
    name: "AWS region clustering",
    short: "AWS cluster",
    rank: 6,
    peakBps: 2,
    frequency: 1.0,
    bps: 2,
    conversion: "195 ms Tokyo→Ashburn gap, taxed every trade",
    fix: "Global pricing. Geography is not an input.",
  },
  {
    slug: "listing-frontrun",
    name: "Listing front-running",
    short: "Listing FR",
    rank: 7,
    peakBps: 800,
    frequency: 0.002,
    bps: 1.6,
    conversion: "800 bps peak × 0.2% of trades = 1.6 bps",
    fix: "BLS-resolved bets. No listing pipeline to leak.",
  },
  {
    slug: "maker-rebate",
    name: "Maker rebate / inverted fees",
    short: "Rebate",
    rank: 8,
    peakBps: 1.5,
    frequency: 1.0,
    bps: 1.5,
    conversion: "1.5 bps peak × every match = 1.5 bps",
    fix: "No maker/taker model. One fee, whoever posts.",
  },
  {
    slug: "oracle-peek",
    name: "Oracle / price-feed peek",
    short: "Oracle peek",
    rank: 9,
    peakBps: 12,
    frequency: 0.05,
    bps: 0.6,
    conversion: "12 bps peak × 5% price-sensitive ticks = 0.6 bps",
    fix: "BLS-aggregated consensus. No single peek.",
  },
  {
    slug: "colocation",
    name: "Colocation latency edge",
    short: "Colocation",
    rank: 10,
    peakBps: 0.5,
    frequency: 1.0,
    bps: 0.5,
    conversion: "0.5 bps global latency-arbitrage tax, every trade",
    fix: "A parimutuel pool with no engine to game.",
  },
  {
    slug: "api-rate-ceiling",
    name: "API rate ceiling",
    short: "API rate",
    rank: 11,
    peakBps: 0.5,
    frequency: 1.0,
    bps: 0.5,
    conversion: "One public ceiling, institutional tiers undisclosed",
    fix: "One rate for everyone, pool resolves once a round.",
  },
  {
    slug: "last-look",
    name: "Last-look quote rejection",
    short: "Last look",
    rank: 12,
    peakBps: 2,
    frequency: 0.1,
    bps: 0.2,
    conversion: "2 bps peak × 10% volatile fills = 0.2 bps",
    fix: "A sealed-bid auction with no last-look step.",
  },
  {
    slug: "adl-visibility",
    name: "ADL / liquidation visibility",
    short: "ADL",
    rank: 13,
    peakBps: 4,
    frequency: 0.001,
    bps: 0.004,
    conversion: "4 bps peak × 0.1% cascade trades = 0.004 bps",
    fix: "No leverage, so no forced-liquidation pathway.",
  },
];

export const TOTAL_BPS = +MECHANISMS.reduce((a, m) => a + m.bps, 0).toFixed(1);
export const MAX_BPS = Math.max(...MECHANISMS.map((m) => m.bps));
