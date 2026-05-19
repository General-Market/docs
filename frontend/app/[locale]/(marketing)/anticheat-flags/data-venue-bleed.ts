import { EDGE_WAYS } from './data-edge-ways'

export interface VenueBleed {
  slug: string
  name: string
  /** The named maxed-out MM (or class of actor) running the lane at this venue. */
  mm: string
  /** Slugs from EDGE_WAYS that are documented as active at this venue. */
  active: string[]
}

/**
 * Per-venue mapping of which mechanisms from EDGE_WAYS are documented as active
 * at that venue. Total per-trade bps = sum of EDGE_WAYS[slug].bps for slugs in `active`.
 *
 * Conservative selection. Only mechanisms with sourced receipts on this venue
 * in the matrix below. Where a venue could in principle run more (e.g. all spot
 * exchanges have some PFOF-adjacent behaviour), we only list what's documented.
 */
export const VENUE_BLEEDS: VenueBleed[] = [
  {
    slug: 'polymarket',
    name: 'Polymarket',
    mm: 'Susquehanna desk',
    active: ['oracle-peek', 'order-flow-vis', 'maker-rebate'],
  },
  {
    slug: 'hyperliquid',
    name: 'Hyperliquid',
    mm: 'Tokyo arbitrage desk',
    active: ['region-cluster', 'order-flow-vis', 'maker-rebate', 'adl-visibility'],
  },
  {
    slug: 'binance',
    name: 'Binance',
    mm: 'Wintermute / Sigma Chain',
    active: ['listing-frontrun', 'vip-fee-tier', 'colocation', 'region-cluster', 'order-flow-vis', 'api-rate-ceiling', 'adl-visibility'],
  },
  {
    slug: 'kalshi',
    name: 'Kalshi',
    mm: 'Susquehanna (designated)',
    active: ['maker-rebate', 'b-book', 'order-flow-vis'],
  },
  {
    slug: 'coinbase',
    name: 'Coinbase',
    mm: 'Internal listing-pipeline insiders',
    active: ['listing-frontrun', 'pfof', 'vip-fee-tier', 'api-rate-ceiling'],
  },
  {
    slug: 'bybit',
    name: 'Bybit',
    mm: 'Tier-1 listing partners',
    active: ['listing-frontrun', 'vip-fee-tier', 'colocation', 'order-flow-vis', 'adl-visibility'],
  },
  {
    slug: 'pumpfun',
    name: 'Pump.fun',
    mm: 'Jito-bundle sniper bots',
    active: ['jito-mev', 'order-flow-vis', 'oracle-peek'],
  },
  {
    slug: 'deribit',
    name: 'Deribit',
    mm: 'Institutional options desks',
    active: ['vip-fee-tier', 'colocation', 'order-flow-vis', 'last-look'],
  },
  {
    slug: 'robinhood',
    name: 'Robinhood',
    mm: 'Citadel Securities',
    active: ['pfof', 'b-book', 'last-look', 'api-rate-ceiling'],
  },
  {
    slug: 'ibkr',
    name: 'IBKR',
    mm: 'IBKR Lite wholesalers',
    active: ['pfof', 'api-rate-ceiling'],
  },
  {
    slug: 'etoro',
    name: 'eToro',
    mm: 'eToro Markets (b-book)',
    active: ['b-book', 'last-look', 'vip-fee-tier'],
  },
]

export interface VenueBleedComputed extends VenueBleed {
  /** Sum of bps from active mechanisms. What the MM books per round-trip. */
  bpsPerTrade: number
  /** Triple-bar values: cumulative bps you'd need to break even at N trades. */
  cumulative: {
    n100: number
    n1k: number
    n100k: number
  }
}

export function computeVenueBleeds(): VenueBleedComputed[] {
  const bpsBySlug = new Map(EDGE_WAYS.map(w => [w.slug, w.bps]))
  return VENUE_BLEEDS.map(v => {
    const bpsPerTrade = v.active.reduce((acc, slug) => acc + (bpsBySlug.get(slug) ?? 0), 0)
    return {
      ...v,
      bpsPerTrade,
      cumulative: {
        n100: bpsPerTrade * 100,
        n1k: bpsPerTrade * 1_000,
        n100k: bpsPerTrade * 100_000,
      },
    }
  }).sort((a, b) => b.bpsPerTrade - a.bpsPerTrade)
}
