// Data mirrored from frontend/app/[locale]/(marketing)/anticheat-flags/.
// Single source of truth lives in the frontend — this file is the
// video-side snapshot. If the page values move materially, refresh here.

import type { GlowBar } from "./GlowBars";

// Venue palette. Each venue gets a single color used for its pill and halo.
// Hand-picked to map to the brand or to a memorable association.
const C = {
  // Cool blues — exchanges that play it straight in the UI but tax in fees.
  binance: "#F0B90B",
  bybit: "#F7A600",
  coinbase: "#0052FF",
  hyperliquid: "#97FCE4",
  deribit: "#7BFF8E",
  pumpfun: "#A78BFA",
  // Prediction markets.
  polymarket: "#5EA0FF",
  kalshi: "#06CB9D",
  // Brokers.
  robinhood: "#B7F60D",
  ibkr: "#FF7A5C",
  etoro: "#FF4F8D",
  // Generic accent for mechanisms.
  cobalt: "#5B79FF",
  base: "#0052FF",
  amber: "#FFBE3D",
  rose: "#FF4F8D",
  emerald: "#34D399",
  white: "#F4F6F8",
};

// ─── 1. Thirteen mechanisms ────────────────────────────────────────────────
// Effective bps per round-trip = peak × frequency. Sorted descending.
// Values pulled from data-edge-ways.ts (frontend).

export const MECHANISM_BARS: GlowBar[] = [
  { key: "jito-mev", value: 60, topLabel: "60.0", bottomLabel: "Jito-bundle MEV", color: C.pumpfun },
  { key: "pfof", value: 17, topLabel: "17.0", bottomLabel: "PFOF markup", color: C.robinhood },
  { key: "b-book", value: 15, topLabel: "15.0", bottomLabel: "Internal b-book", color: C.etoro },
  { key: "vip-fee-tier", value: 11, topLabel: "11.0", bottomLabel: "VIP fee tier", color: C.binance },
  { key: "order-flow-vis", value: 2, topLabel: "2.0", bottomLabel: "Flow visibility", color: C.deribit },
  { key: "region-cluster", value: 2, topLabel: "2.0", bottomLabel: "AWS cluster", color: C.hyperliquid },
  { key: "listing-frontrun", value: 1.6, topLabel: "1.6", bottomLabel: "Listing frontrun", color: C.coinbase },
  { key: "maker-rebate", value: 1.5, topLabel: "1.5", bottomLabel: "Maker rebate", color: C.kalshi },
  { key: "oracle-peek", value: 0.6, topLabel: "0.6", bottomLabel: "Oracle peek", color: C.polymarket },
  { key: "colocation", value: 0.5, topLabel: "0.5", bottomLabel: "Colocation", color: C.amber },
  { key: "api-rate", value: 0.5, topLabel: "0.5", bottomLabel: "API rate", color: C.cobalt },
  { key: "last-look", value: 0.2, topLabel: "0.2", bottomLabel: "Last look", color: C.ibkr },
  { key: "adl", value: 0.004, topLabel: "0.004", bottomLabel: "ADL cascade", color: C.rose },
];

// ─── 2. Per-venue bleed at 1,000 trades ────────────────────────────────────
// bpsPerTrade × 1,000 ÷ 100 = % bleed at the central estimate.
// Sorted descending. Values pulled from data-venue-bleed.ts.

export const VENUE_BLEED_BARS: GlowBar[] = [
  { key: "pumpfun", value: 80.3, topLabel: "+803%", bottomLabel: "Pump.fun", color: C.pumpfun },
  { key: "polymarket", value: 17.7, topLabel: "+177%", bottomLabel: "Polymarket", color: C.polymarket },
  { key: "robinhood", value: 17.3, topLabel: "+173%", bottomLabel: "Robinhood", color: C.robinhood },
  { key: "etoro", value: 16.7, topLabel: "+167%", bottomLabel: "eToro", color: C.etoro },
  { key: "binance", value: 16.2, topLabel: "+162%", bottomLabel: "Binance", color: C.binance },
  { key: "coinbase", value: 13.0, topLabel: "+130%", bottomLabel: "Coinbase", color: C.coinbase },
  { key: "ibkr", value: 12.5, topLabel: "+125%", bottomLabel: "IBKR", color: C.ibkr },
  { key: "kalshi", value: 4.5, topLabel: "+45%", bottomLabel: "Kalshi", color: C.kalshi },
  { key: "bybit", value: 4.0, topLabel: "+40%", bottomLabel: "Bybit", color: C.bybit },
  { key: "deribit", value: 2.2, topLabel: "+22%", bottomLabel: "Deribit", color: C.deribit },
  { key: "hyperliquid", value: 1.9, topLabel: "+19%", bottomLabel: "Hyperliquid", color: C.hyperliquid },
];

// ─── 3. Colocation gated latency ───────────────────────────────────────────
// edgeMs — the latency gap that survives after a retail VPS is already
// running in the right region. Sorted descending.

export const COLOCATION_BARS: GlowBar[] = [
  { key: "etoro", value: 100, topLabel: "+100ms", bottomLabel: "eToro", color: C.etoro },
  { key: "pumpfun", value: 50, topLabel: "+50ms", bottomLabel: "Pump.fun", color: C.pumpfun },
  { key: "ibkr", value: 50, topLabel: "+50ms", bottomLabel: "IBKR", color: C.ibkr },
  { key: "kalshi", value: 49, topLabel: "+49ms", bottomLabel: "Kalshi", color: C.kalshi },
  { key: "robinhood", value: 35, topLabel: "+35ms", bottomLabel: "Robinhood", color: C.robinhood },
  { key: "hyperliquid", value: 25, topLabel: "+25ms", bottomLabel: "Hyperliquid", color: C.hyperliquid },
  { key: "binance", value: 20, topLabel: "+20ms", bottomLabel: "Binance", color: C.binance },
  { key: "bybit", value: 15, topLabel: "+15ms", bottomLabel: "Bybit", color: C.bybit },
  { key: "polymarket", value: 5, topLabel: "+5ms", bottomLabel: "Polymarket", color: C.polymarket },
  { key: "deribit", value: 5, topLabel: "+5ms", bottomLabel: "Deribit", color: C.deribit },
  { key: "coinbase", value: 5, topLabel: "+5ms", bottomLabel: "Coinbase", color: C.coinbase },
];

// ─── 4. Fee tier round-trip rebate (VIP 0 vs VIP 9 disclosed deltas) ───────
// From data-fee-tiers (numbers visible in the page footer cards).

export const FEE_TIER_BARS: GlowBar[] = [
  { key: "binance", value: 15.4, topLabel: "−15.4 bps", bottomLabel: "Binance", color: C.binance },
  { key: "bybit", value: 12.0, topLabel: "−12.0 bps", bottomLabel: "Bybit", color: C.bybit },
  { key: "deribit", value: 9.5, topLabel: "−9.5 bps", bottomLabel: "Deribit", color: C.deribit },
  { key: "coinbase", value: 8.0, topLabel: "−8.0 bps", bottomLabel: "Coinbase", color: C.coinbase },
  { key: "hyperliquid", value: 4.4, topLabel: "−4.4 bps", bottomLabel: "Hyperliquid", color: C.hyperliquid },
  { key: "kalshi", value: 3.5, topLabel: "−3.5 bps", bottomLabel: "Kalshi", color: C.kalshi },
];

// ─── 5. Cost of maxing out advantages ($/mo to keep an MM seat) ────────────
// Robinhood is the outlier — its composite extractor seat costs $110M/mo to
// run but nets +$1.85M after capturing $115.4M in PFOF/spread revenue. Use a
// log-friendly trim by capping the chart at "M/mo" granularity.

export const MAXING_COST_BARS: GlowBar[] = [
  { key: "robinhood", value: 110.55, topLabel: "$110M", bottomLabel: "Robinhood", color: C.robinhood },
  { key: "binance", value: 4.37, topLabel: "$4.4M", bottomLabel: "Binance", color: C.binance },
  { key: "bybit", value: 4.07, topLabel: "$4.1M", bottomLabel: "Bybit", color: C.bybit },
  { key: "deribit", value: 2.30, topLabel: "$2.3M", bottomLabel: "Deribit", color: C.deribit },
  { key: "hyperliquid", value: 1.15, topLabel: "$1.2M", bottomLabel: "Hyperliquid", color: C.hyperliquid },
  { key: "pumpfun", value: 0.63, topLabel: "$626k", bottomLabel: "Pump.fun", color: C.pumpfun },
  { key: "kalshi", value: 0.35, topLabel: "$348k", bottomLabel: "Kalshi", color: C.kalshi },
  { key: "ibkr", value: 0.18, topLabel: "$180k", bottomLabel: "IBKR", color: C.ibkr },
  { key: "polymarket", value: 0.13, topLabel: "$131k", bottomLabel: "Polymarket", color: C.polymarket },
  { key: "coinbase", value: 0.10, topLabel: "$104k", bottomLabel: "Coinbase", color: C.coinbase },
];

// ─── 6. Documented incidents per venue ──────────────────────────────────────
// Pulled from /anticheat-flags venue pills (incidents.length).

export const VENUE_RECEIPTS_BARS: GlowBar[] = [
  { key: "binance", value: 12, topLabel: "12", bottomLabel: "Binance", color: C.binance },
  { key: "polymarket", value: 9, topLabel: "9", bottomLabel: "Polymarket", color: C.polymarket },
  { key: "hyperliquid", value: 6, topLabel: "6", bottomLabel: "Hyperliquid", color: C.hyperliquid },
  { key: "coinbase", value: 6, topLabel: "6", bottomLabel: "Coinbase", color: C.coinbase },
  { key: "robinhood", value: 4, topLabel: "4", bottomLabel: "Robinhood", color: C.robinhood },
  { key: "kalshi", value: 4, topLabel: "4", bottomLabel: "Kalshi", color: C.kalshi },
  { key: "bybit", value: 4, topLabel: "4", bottomLabel: "Bybit", color: C.bybit },
  { key: "ibkr", value: 3, topLabel: "3", bottomLabel: "IBKR", color: C.ibkr },
  { key: "deribit", value: 3, topLabel: "3", bottomLabel: "Deribit", color: C.deribit },
  { key: "etoro", value: 3, topLabel: "3", bottomLabel: "eToro", color: C.etoro },
  { key: "pumpfun", value: 2, topLabel: "2", bottomLabel: "Pump.fun", color: C.pumpfun },
];
