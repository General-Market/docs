// Per-venue bar-chart data, mirrored from the /anticheat-flags page sections.
// Each topic that has a per-venue chart on the page gets a row set here, keyed
// by the venue slug in logos.ts so the chart can draw the brand mark as the
// row label. Same numbers as the page — this is a mirror, not a new source.

export type VenueBar = {
  /** VENUES key in logos.ts — drives the logo drawn as the row label. */
  slug: string;
  /** Fallback name when the venue has no wordmark. */
  name: string;
  /** Faded outer bar — the full edge. */
  full: number;
  /** Solid inner bar — the gated portion no rental can buy. */
  solid: number;
  /** Big accent value, e.g. "+100ms". */
  valueTop: string;
  /** Tertiary sub-value, e.g. "100ms gated". */
  valueSub: string;
};

// Colocation latency edge — mirrored from ColocationSection's LATENCY_ROWS.
// full = edgeMs (the latency gap left after a retail VPS is in-region),
// solid = gatedMs (the part behind a colo contract / designated-MM / KYC gate).
export const COLOCATION_BARS: VenueBar[] = [
  { slug: "etoro", name: "eToro", full: 100, solid: 100, valueTop: "+100ms", valueSub: "100ms gated" },
  { slug: "pumpfun", name: "Pump.fun", full: 50, solid: 50, valueTop: "+50ms", valueSub: "50ms gated" },
  { slug: "ibkr", name: "IBKR", full: 50, solid: 50, valueTop: "+50ms", valueSub: "50ms gated" },
  { slug: "kalshi", name: "Kalshi", full: 49, solid: 0, valueTop: "+49ms", valueSub: "0ms gated" },
  { slug: "robinhood", name: "Robinhood", full: 35, solid: 35, valueTop: "+35ms", valueSub: "35ms gated" },
  { slug: "hyperliquid", name: "Hyperliquid", full: 25, solid: 25, valueTop: "+25ms", valueSub: "25ms gated" },
  { slug: "binance", name: "Binance", full: 20, solid: 5, valueTop: "+20ms", valueSub: "5ms gated" },
  { slug: "bybit", name: "Bybit", full: 15, solid: 5, valueTop: "+15ms", valueSub: "5ms gated" },
  { slug: "polymarket", name: "Polymarket", full: 5, solid: 5, valueTop: "+5ms", valueSub: "5ms gated" },
  { slug: "deribit", name: "Deribit", full: 5, solid: 5, valueTop: "+5ms", valueSub: "5ms gated" },
  { slug: "coinbase", name: "Coinbase", full: 5, solid: 5, valueTop: "+5ms", valueSub: "5ms gated" },
];

// Per-topic bar sets keyed by the video mechanism slug. Single-tone bars:
// full === solid === the row's magnitude. Mirrored verbatim from the
// /anticheat-flags page (EDGE_TOPICS, FEE_TIER_VENUES, LATENCY_ROWS).
export type TopicBars = {
  /** The video mechanism key this chart is shown for. */
  mechanism: string;
  /** Short human unit, e.g. "$M insider profit". */
  unitLabel: string;
  /** The General-row payoff line (the topic's generalMarketLabel). */
  caption: string;
  rows: VenueBar[];
};

export const TOPIC_BARS: Record<string, TopicBars> = {
  colocation: {
    mechanism: "colocation",
    unitLabel: "ms latency edge",
    caption:
      "Blocks last a minute. Arrival inside the minute never moves the settlement.",
    rows: COLOCATION_BARS,
  },

  "vip-fee-tier": {
    mechanism: "vip-fee-tier",
    unitLabel: "bps fee edge",
    caption: "One fee. No tier table.",
    rows: [
      { slug: "coinbase", name: "Coinbase", full: 200, solid: 200, valueTop: "200 bps", valueSub: "vs retail" },
      { slug: "kalshi", name: "Kalshi", full: 500, solid: 500, valueTop: "500 bps", valueSub: "vs retail" },
      { slug: "polymarket", name: "Polymarket", full: 175, solid: 175, valueTop: "175 bps", valueSub: "vs retail" },
      { slug: "robinhood", name: "Robinhood", full: 60, solid: 60, valueTop: "60 bps", valueSub: "vs retail" },
      { slug: "bybit", name: "Bybit", full: 11.8, solid: 11.8, valueTop: "11.8 bps", valueSub: "vs retail" },
      { slug: "ibkr", name: "IBKR", full: 10, solid: 10, valueTop: "10 bps", valueSub: "vs retail" },
      { slug: "binance", name: "Binance", full: 9, solid: 9, valueTop: "9 bps", valueSub: "vs retail" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 7, solid: 7, valueTop: "7 bps", valueSub: "vs retail" },
      { slug: "deribit", name: "Deribit", full: 4, solid: 4, valueTop: "4 bps", valueSub: "vs retail" },
      { slug: "etoro", name: "eToro", full: 2, solid: 2, valueTop: "2 bps", valueSub: "vs retail" },
      { slug: "pumpfun", name: "Pump.fun", full: 0, solid: 0, valueTop: "0 bps", valueSub: "vs retail" },
    ],
  },

  "listing-frontrun": {
    mechanism: "listing-frontrun",
    unitLabel: "$M insider profit (documented)",
    caption:
      "A leaked listing tells you nothing about the ninety-nine others sealed in the same block.",
    rows: [
      { slug: "pumpfun", name: "Pump.fun", full: 2.5, solid: 2.5, valueTop: "$2.5M", valueSub: "insider profit" },
      { slug: "coinbase", name: "Coinbase", full: 2.45, solid: 2.45, valueTop: "$2.45M", valueSub: "insider profit" },
      { slug: "binance", name: "Binance", full: 1.7, solid: 1.7, valueTop: "$1.7M", valueSub: "insider profit" },
    ],
  },

  "order-flow-vis": {
    mechanism: "order-flow-vis",
    unitLabel: "score 0-10 (MM flow visibility)",
    caption:
      "Orders are hashed before reveal. Even the oracle nodes are blind until the batch closes.",
    rows: [
      { slug: "etoro", name: "eToro", full: 10, solid: 10, valueTop: "10", valueSub: "flow vis · 0–10" },
      { slug: "binance", name: "Binance", full: 9, solid: 9, valueTop: "9", valueSub: "flow vis · 0–10" },
      { slug: "robinhood", name: "Robinhood", full: 9, solid: 9, valueTop: "9", valueSub: "flow vis · 0–10" },
      { slug: "polymarket", name: "Polymarket", full: 8, solid: 8, valueTop: "8", valueSub: "flow vis · 0–10" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 8, solid: 8, valueTop: "8", valueSub: "flow vis · 0–10" },
      { slug: "coinbase", name: "Coinbase", full: 7, solid: 7, valueTop: "7", valueSub: "flow vis · 0–10" },
      { slug: "kalshi", name: "Kalshi", full: 6, solid: 6, valueTop: "6", valueSub: "flow vis · 0–10" },
      { slug: "pumpfun", name: "Pump.fun", full: 6, solid: 6, valueTop: "6", valueSub: "flow vis · 0–10" },
      { slug: "bybit", name: "Bybit", full: 5, solid: 5, valueTop: "5", valueSub: "flow vis · 0–10" },
      { slug: "deribit", name: "Deribit", full: 4, solid: 4, valueTop: "4", valueSub: "flow vis · 0–10" },
      { slug: "ibkr", name: "IBKR", full: 2, solid: 2, valueTop: "2", valueSub: "flow vis · 0–10" },
    ],
  },

  pfof: {
    mechanism: "pfof",
    unitLabel: "$M / yr internalization",
    caption: "Every order is public to every node. There is nothing left to sell.",
    rows: [
      { slug: "robinhood", name: "Robinhood", full: 1400, solid: 1400, valueTop: "$1400M", valueSub: "/ yr" },
      { slug: "etoro", name: "eToro", full: 250, solid: 250, valueTop: "$250M", valueSub: "/ yr" },
      { slug: "coinbase", name: "Coinbase", full: 0, solid: 0, valueTop: "$0M", valueSub: "/ yr" },
      { slug: "ibkr", name: "IBKR", full: 0, solid: 0, valueTop: "$0M", valueSub: "/ yr" },
    ],
  },

  "region-cluster": {
    mechanism: "region-cluster",
    unitLabel: "ms latency edge",
    caption: "Trades resolve once a minute. A faster feed buys nothing.",
    rows: [
      { slug: "ibkr", name: "IBKR", full: 1000, solid: 1000, valueTop: "+1000ms", valueSub: "" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 500, solid: 500, valueTop: "+500ms", valueSub: "" },
      { slug: "pumpfun", name: "Pump.fun", full: 200, solid: 200, valueTop: "+200ms", valueSub: "" },
      { slug: "kalshi", name: "Kalshi", full: 100, solid: 100, valueTop: "+100ms", valueSub: "" },
      { slug: "robinhood", name: "Robinhood", full: 50, solid: 50, valueTop: "+50ms", valueSub: "" },
      { slug: "etoro", name: "eToro", full: 30, solid: 30, valueTop: "+30ms", valueSub: "" },
      { slug: "bybit", name: "Bybit", full: 28, solid: 28, valueTop: "+28ms", valueSub: "" },
      { slug: "binance", name: "Binance", full: 26, solid: 26, valueTop: "+26ms", valueSub: "" },
      { slug: "coinbase", name: "Coinbase", full: 20, solid: 20, valueTop: "+20ms", valueSub: "" },
      { slug: "deribit", name: "Deribit", full: 15, solid: 15, valueTop: "+15ms", valueSub: "" },
      { slug: "polymarket", name: "Polymarket", full: 10, solid: 10, valueTop: "+10ms", valueSub: "" },
    ],
  },

  "jito-mev": {
    mechanism: "jito-mev",
    unitLabel: "bps priority edge",
    caption: "Large losses are capped per order. A whale cannot pick off the small taker.",
    rows: [
      { slug: "pumpfun", name: "Pump.fun", full: 8, solid: 8, valueTop: "8 bps", valueSub: "priority" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 4, solid: 4, valueTop: "4 bps", valueSub: "priority" },
      { slug: "polymarket", name: "Polymarket", full: 5, solid: 5, valueTop: "5 bps", valueSub: "priority" },
      { slug: "binance", name: "Binance", full: 3, solid: 3, valueTop: "3 bps", valueSub: "priority" },
      { slug: "deribit", name: "Deribit", full: 2, solid: 2, valueTop: "2 bps", valueSub: "priority" },
      { slug: "coinbase", name: "Coinbase", full: 1, solid: 1, valueTop: "1 bps", valueSub: "priority" },
      { slug: "kalshi", name: "Kalshi", full: 0, solid: 0, valueTop: "0 bps", valueSub: "priority" },
      { slug: "bybit", name: "Bybit", full: 0, solid: 0, valueTop: "0 bps", valueSub: "priority" },
    ],
  },

  "last-look": {
    mechanism: "last-look",
    unitLabel: "× retail cancel allowance",
    caption: "Orders cannot be cancelled. The seal is the cancellation.",
    rows: [
      { slug: "binance", name: "Binance", full: 249, solid: 249, valueTop: "249×", valueSub: "vs retail" },
      { slug: "bybit", name: "Bybit", full: 199, solid: 199, valueTop: "199×", valueSub: "vs retail" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 50, solid: 50, valueTop: "50×", valueSub: "vs retail" },
      { slug: "polymarket", name: "Polymarket", full: 30, solid: 30, valueTop: "30×", valueSub: "vs retail" },
      { slug: "coinbase", name: "Coinbase", full: 20, solid: 20, valueTop: "20×", valueSub: "vs retail" },
      { slug: "deribit", name: "Deribit", full: 10, solid: 10, valueTop: "10×", valueSub: "vs retail" },
      { slug: "kalshi", name: "Kalshi", full: 5, solid: 5, valueTop: "5×", valueSub: "vs retail" },
    ],
  },

  "api-rate-ceiling": {
    mechanism: "api-rate-ceiling",
    unitLabel: "× retail req/min",
    caption: "One block per minute. There is nothing for the HFT loop to spin against.",
    rows: [
      { slug: "binance", name: "Binance", full: 104, solid: 104, valueTop: "104×", valueSub: "req/min" },
      { slug: "polymarket", name: "Polymarket", full: 50, solid: 50, valueTop: "50×", valueSub: "req/min" },
      { slug: "pumpfun", name: "Pump.fun", full: 30, solid: 30, valueTop: "30×", valueSub: "req/min" },
      { slug: "kalshi", name: "Kalshi", full: 20, solid: 20, valueTop: "20×", valueSub: "req/min" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 20, solid: 20, valueTop: "20×", valueSub: "req/min" },
      { slug: "deribit", name: "Deribit", full: 10, solid: 10, valueTop: "10×", valueSub: "req/min" },
      { slug: "bybit", name: "Bybit", full: 3.3, solid: 3.3, valueTop: "3.3×", valueSub: "req/min" },
      { slug: "coinbase", name: "Coinbase", full: 3, solid: 3, valueTop: "3×", valueSub: "req/min" },
      { slug: "ibkr", name: "IBKR", full: 1, solid: 1, valueTop: "1×", valueSub: "req/min" },
      { slug: "etoro", name: "eToro", full: 1, solid: 1, valueTop: "1×", valueSub: "req/min" },
    ],
  },

  "maker-rebate": {
    mechanism: "maker-rebate",
    unitLabel: "bps/side maker rebate",
    caption: "One fee. No tier table.",
    rows: [
      { slug: "coinbase", name: "Coinbase", full: 4, solid: 4, valueTop: "4 bps", valueSub: "/ side" },
      { slug: "kalshi", name: "Kalshi", full: 0, solid: 0, valueTop: "0 bps", valueSub: "/ side" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 3, solid: 3, valueTop: "3 bps", valueSub: "/ side" },
      { slug: "deribit", name: "Deribit", full: 1, solid: 1, valueTop: "1 bps", valueSub: "/ side" },
      { slug: "bybit", name: "Bybit", full: 0.4, solid: 0.4, valueTop: "0.4 bps", valueSub: "/ side" },
      { slug: "binance", name: "Binance", full: 1, solid: 1, valueTop: "1 bps", valueSub: "/ side" },
      { slug: "polymarket", name: "Polymarket", full: 0, solid: 0, valueTop: "0 bps", valueSub: "/ side" },
    ],
  },

  "maxing-out": {
    mechanism: "maxing-out",
    unitLabel: "$M / yr cash subsidy",
    caption:
      "Makers are paid for showing up, not for size. The whale rebate never existed.",
    rows: [
      { slug: "kalshi", name: "Kalshi", full: 60, solid: 60, valueTop: "$60M", valueSub: "/ yr subsidy" },
      { slug: "coinbase", name: "Coinbase", full: 50, solid: 50, valueTop: "$50M", valueSub: "/ yr subsidy" },
      { slug: "binance", name: "Binance", full: 40, solid: 40, valueTop: "$40M", valueSub: "/ yr subsidy" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 30, solid: 30, valueTop: "$30M", valueSub: "/ yr subsidy" },
      { slug: "deribit", name: "Deribit", full: 20, solid: 20, valueTop: "$20M", valueSub: "/ yr subsidy" },
      { slug: "bybit", name: "Bybit", full: 15, solid: 15, valueTop: "$15M", valueSub: "/ yr subsidy" },
      { slug: "etoro", name: "eToro", full: 10, solid: 10, valueTop: "$10M", valueSub: "/ yr subsidy" },
      { slug: "polymarket", name: "Polymarket", full: 3, solid: 3, valueTop: "$3M", valueSub: "/ yr subsidy" },
    ],
  },

  "funding-edge": {
    mechanism: "funding-edge",
    unitLabel: "bps/yr boundary-arb edge",
    caption: "No perpetuals. No funding clock to bracket.",
    rows: [
      { slug: "hyperliquid", name: "Hyperliquid", full: 8760, solid: 8760, valueTop: "8760 bps", valueSub: "/ yr" },
      { slug: "deribit", name: "Deribit", full: 5475, solid: 5475, valueTop: "5475 bps", valueSub: "/ yr" },
      { slug: "binance", name: "Binance", full: 820, solid: 820, valueTop: "820 bps", valueSub: "/ yr" },
      { slug: "coinbase", name: "Coinbase", full: 600, solid: 600, valueTop: "600 bps", valueSub: "/ yr" },
      { slug: "bybit", name: "Bybit", full: 200, solid: 200, valueTop: "200 bps", valueSub: "/ yr" },
    ],
  },

  liquidation: {
    mechanism: "liquidation",
    unitLabel: "$B liquidated in named cascade",
    caption:
      "Leverage runs entirely through parimutuel. The auto-liquidator never existed.",
    rows: [
      { slug: "bybit", name: "Bybit", full: 9.55, solid: 9.55, valueTop: "$9.55B", valueSub: "liquidated" },
      { slug: "binance", name: "Binance", full: 1.5, solid: 1.5, valueTop: "$1.5B", valueSub: "liquidated" },
      { slug: "robinhood", name: "Robinhood", full: 1.4, solid: 1.4, valueTop: "$1.4B", valueSub: "liquidated" },
      { slug: "ibkr", name: "IBKR", full: 0.104, solid: 0.104, valueTop: "$0.104B", valueSub: "liquidated" },
      { slug: "hyperliquid", name: "Hyperliquid", full: 0.0135, solid: 0.0135, valueTop: "$0.0135B", valueSub: "liquidated" },
      { slug: "deribit", name: "Deribit", full: 0.013, solid: 0.013, valueTop: "$0.013B", valueSub: "liquidated" },
      { slug: "coinbase", name: "Coinbase", full: 0.001, solid: 0.001, valueTop: "$0.001B", valueSub: "liquidated" },
      { slug: "etoro", name: "eToro", full: 0.0005, solid: 0.0005, valueTop: "$0.0005B", valueSub: "liquidated" },
    ],
  },
};
