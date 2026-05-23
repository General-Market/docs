// Venue brand assets (fetched into public/exchange-logos/) plus the
// mechanism→venue mapping mirrored from data-venue-bleed.ts. Drives the
// per-exchange subdiagrams: for each mechanism, which venues run it.

export type VenueBrand = {
  slug: string;
  name: string;
  /** Brand color, tuned to read on the light field. */
  color: string;
  /** Square mark, when one exists. */
  icon?: string;
  /** Full-name lockup, when one exists. */
  wordmark?: string;
};

const L = "exchange-logos";

export const VENUES: Record<string, VenueBrand> = {
  binance: { slug: "binance", name: "Binance", color: "#E0A608", icon: `${L}/binance-icon.svg`, wordmark: `${L}/binance-wordmark.svg` },
  coinbase: { slug: "coinbase", name: "Coinbase", color: "#0052FF", icon: `${L}/coinbase-icon.svg`, wordmark: `${L}/coinbase-wordmark.svg` },
  // bybit-icon is white-on-transparent (built for dark UI) — invisible on
  // the light card, so the wordmark carries it.
  bybit: { slug: "bybit", name: "Bybit", color: "#E08A00", wordmark: `${L}/bybit-wordmark.svg` },
  hyperliquid: { slug: "hyperliquid", name: "Hyperliquid", color: "#0AA88A", icon: `${L}/hyperliquid-icon.png` },
  deribit: { slug: "deribit", name: "Deribit", color: "#0A7C53", icon: `${L}/deribit-icon.svg`, wordmark: `${L}/deribit-wordmark.svg` },
  pumpfun: { slug: "pumpfun", name: "Pump.fun", color: "#3Fae5a", icon: `${L}/pumpfun-icon.png` },
  polymarket: { slug: "polymarket", name: "Polymarket", color: "#1652F0", icon: `${L}/polymarket-icon.png`, wordmark: `${L}/polymarket-wordmark.svg` },
  kalshi: { slug: "kalshi", name: "Kalshi", color: "#0A8F6B", wordmark: `${L}/kalshi-wordmark.svg` },
  robinhood: { slug: "robinhood", name: "Robinhood", color: "#04B33C", icon: `${L}/robinhood-icon.svg`, wordmark: `${L}/robinhood-wordmark.svg` },
  ibkr: { slug: "ibkr", name: "IBKR", color: "#C8102E", wordmark: `${L}/ibkr-wordmark.svg` },
  etoro: { slug: "etoro", name: "eToro", color: "#0FA82E", wordmark: `${L}/etoro-wordmark.svg` },
};

// Which mechanisms are documented active at each venue (data-venue-bleed.ts).
const VENUE_MECHANISMS: Record<string, string[]> = {
  polymarket: ["listing-frontrun", "oracle-peek", "colocation", "order-flow-vis", "maker-rebate", "b-book"],
  hyperliquid: ["region-cluster", "colocation", "order-flow-vis", "maker-rebate", "adl-visibility"],
  binance: ["listing-frontrun", "vip-fee-tier", "colocation", "region-cluster", "order-flow-vis", "api-rate-ceiling", "adl-visibility"],
  kalshi: ["maker-rebate", "b-book", "order-flow-vis"],
  coinbase: ["listing-frontrun", "pfof", "vip-fee-tier", "api-rate-ceiling"],
  bybit: ["listing-frontrun", "vip-fee-tier", "colocation", "order-flow-vis", "adl-visibility"],
  pumpfun: ["jito-mev", "order-flow-vis", "oracle-peek"],
  deribit: ["vip-fee-tier", "colocation", "order-flow-vis", "last-look"],
  robinhood: ["pfof", "b-book", "last-look", "api-rate-ceiling"],
  ibkr: ["pfof", "vip-fee-tier", "api-rate-ceiling"],
  etoro: ["b-book", "last-look", "vip-fee-tier"],
};

// Venue order for stable left-to-right layout — biggest names first.
const VENUE_ORDER = [
  "binance", "coinbase", "bybit", "hyperliquid", "deribit",
  "polymarket", "kalshi", "robinhood", "ibkr", "etoro", "pumpfun",
];

export function venuesForMechanism(mechanismSlug: string): VenueBrand[] {
  return VENUE_ORDER.filter((v) =>
    VENUE_MECHANISMS[v]?.includes(mechanismSlug),
  ).map((v) => VENUES[v]);
}
