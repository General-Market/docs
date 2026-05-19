export interface EdgeWay {
  slug: string
  rank: number
  name: string
  /** Peak basis points when the mechanism actually fires on a single trade. */
  peakBps: number
  /** Probability the mechanism affects any given retail round-trip on an active venue. */
  frequency: number
  /** Amortized bps per round-trip = peakBps × frequency. The honest per-trade cost. */
  bps: number
  /** Lower edge of the defensible amortized range. */
  bpsLow: number
  /** Upper edge of the defensible amortized range. */
  bpsHigh: number
  /** One line: peak × frequency = effective. */
  conversion: string
  /** One line: why the frequency is what it is. */
  frequencyNote: string
  sourceLabel: string
  sourceUrl: string
  fix: string
}

/**
 * Thirteen mechanisms by which exchanges and market makers extract bps from retail.
 * Every value is amortized per round-trip: a rare-but-massive event is multiplied
 * by its trade-frequency, not pretended to fire every trade.
 *
 * Conversion rules (the only math in this section):
 *   - peakBps comes from a fee schedule, a sourced adverse-selection estimate, or
 *     a measured MEV/PFOF study. We anchor to the *published* number, not the
 *     headline-grabbing tail.
 *   - frequency is the probability the mechanism fires on a single retail trade
 *     at a venue where the mechanism is active. 1.0 = every trade.
 *   - bps = peakBps × frequency. That is the central estimate.
 *   - bpsLow and bpsHigh come from the same peer-reviewed range, not from
 *     applying a generic ±% to the central. They are why the chart shows whiskers.
 *
 * Earlier drafts inflated colocation (10 bps) twenty-five times above the published
 * figure in Aquilina–Budish–O'Neill 2020, double-counted cross-connect with colocation,
 * cited the wrong FCA paper for last-look, and asserted an insurance-fund priority that
 * the Binance documentation explicitly does not grant. Those errors are gone.
 *
 * Ranked descending by `bps` (effective per-trade cost).
 */
function make(
  slug: string,
  rank: number,
  name: string,
  peakBps: number,
  frequency: number,
  bpsLow: number,
  bpsHigh: number,
  conversion: string,
  frequencyNote: string,
  sourceLabel: string,
  sourceUrl: string,
  fix: string,
): EdgeWay {
  return {
    slug,
    rank,
    name,
    peakBps,
    frequency,
    bps: +(peakBps * frequency).toFixed(3),
    bpsLow,
    bpsHigh,
    conversion,
    frequencyNote,
    sourceLabel,
    sourceUrl,
    fix,
  }
}

export const EDGE_WAYS: EdgeWay[] = [
  make(
    'jito-mev', 1, 'Jito-bundle MEV (Solana)',
    400, 0.15,
    30, 90,
    '400 bps peak × 0.15 attacked round-trips = 60 bps per round-trip.',
    'Helius MEV Report documents 1.55M sandwich txs in 30 days on Solana, 88.9% success rate, 16 of top 20 sandwiched tokens on pump.fun. Per-swap incidence is inferred — 15% is the mid-band of community estimates, not a measured constant.',
    'Helius · Solana MEV Report',
    'https://www.helius.dev/blog/solana-mev-report',
    'Sealed bets. No mempool to sandwich. No validator with a side bet.',
  ),
  make(
    'pfof', 2, 'PFOF wholesaler markup',
    17, 1.0,
    12, 25,
    '17 bps peak × 1.0 trades affected = 17 bps per round-trip.',
    'Every marketable order is sold to a wholesaler. Schwarz et al. (Journal of Finance 2025, "The Actual Retail Price of Equity Trades") measured 7–46 bps round-trip across six brokers; 17 bps is the kinder end.',
    'SEC Admin Proceeding 3-20171 · Schwarz et al. JF 2025',
    'https://www.sec.gov/files/litigation/admin/2020/33-10906.pdf',
    'No order flow to sell. Bets post directly to the pool.',
  ),
  make(
    'b-book', 3, 'Internal book (b-book)',
    15, 1.0,
    8, 22,
    '15 bps peak × 1.0 trades affected = 15 bps per round-trip.',
    'Every fill on a b-book venue is internalized against the broker. Frequency is one. FCA PS19/18 confirms the structure; the 15 bps midpoint on majors comes from industry TCA estimates, not the policy paper.',
    'FCA PS19/18',
    'https://www.fca.org.uk/publication/policy/ps19-18.pdf',
    'No internal book. The pool is the counterparty.',
  ),
  make(
    'vip-fee-tier', 4, 'VIP fee-tier subsidy',
    11, 1.0,
    8, 17,
    '11 bps peak × 1.0 trades affected = 11 bps per round-trip.',
    'Binance VIP 0 pays 10 bps taker; VIP 9 pays 2.3 bps. Per-side gap is ~7.7 bps; round-trip gap ~15.4. The 11 bps figure sits inside that envelope and below the full round-trip differential.',
    'Binance VIP fee schedule',
    'https://www.binance.com/en/fee/schedule',
    'Flat fee. One tier.',
  ),
  make(
    'order-flow-vis', 5, 'Order-flow visibility',
    2, 1.0,
    0.5, 3,
    '2 bps peak × 1.0 trades affected = 2 bps per round-trip.',
    'The book is visible to the MM at all times. Hendershott–Riordan (JFQA 2013) measured 3.62 bps quoted spread on liquid DAX names; adverse selection from faster traders is a fraction of that — 1–2 bps when the speed gap is present.',
    'Hendershott & Riordan, JFQA 2013',
    'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2001912',
    'Sealed bets. The book is private until the round resolves.',
  ),
  make(
    'region-cluster', 6, 'AWS region clustering',
    2, 1.0,
    1, 5,
    '2 bps peak × 1.0 trades affected = 2 bps per round-trip.',
    'Glassnode (March 2026) measured a 195 ms gap between Tokyo and Ashburn on Hyperliquid. Latency taxes published in the academic record (Budish–Cramton–Shim QJE 2022) sit at ~0.5 bps globally; 2 bps is the defensible upper end for a sustained regional gap.',
    'Glassnode · Coindesk March 2026',
    'https://www.coindesk.com/markets/2026/03/30/hyperliquid-traders-in-tokyo-get-200-millisecond-edge-glassnode-research-shows',
    'Global pricing function. Geography is not an input.',
  ),
  make(
    'listing-frontrun', 7, 'Listing front-running',
    800, 0.002,
    0.5, 8,
    '800 bps peak × 0.002 affected trades = 1.6 bps per round-trip.',
    'Felez-Viñas, Johnson, Putniņš (2022) document insider patterns on 10–25% of Coinbase listings, with abnormal returns of +10% to +40% on affected trades. Per-trade incidence across the full retail tape is ~0.2%.',
    'Felez-Viñas, Johnson, Putniņš (SSRN 2022)',
    'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4184367',
    'Sealed bets resolved by BLS oracle. No listing pipeline to leak.',
  ),
  make(
    'maker-rebate', 8, 'Maker rebate / inverted fees',
    1.5, 1.0,
    0.6, 2.5,
    '1.5 bps peak × 1.0 trades affected = 1.5 bps per round-trip.',
    'Rebates apply on every match. Battalio–Corwin–Jennings (JF 2016) show retail brokers route to maximize maker rebates at the expense of execution quality; Reg NMS Rule 610 caps rebates at 30 mils per share (~0.6 bps round-trip on a $100 stock). Prediction markets run hotter.',
    'Battalio–Corwin–Jennings, JF 2016',
    'https://onlinelibrary.wiley.com/doi/abs/10.1111/jofi.12422',
    'No maker / taker model. One fee, whoever posts.',
  ),
  make(
    'oracle-peek', 9, 'Oracle / price-feed peek',
    12, 0.05,
    0.1, 2,
    '12 bps peak × 0.05 price-sensitive ticks = 0.6 bps per round-trip.',
    'Qin–Zhou–Gervais (2022) measured $1.51M of sandwich profits across 1,379 attacker addresses on 82% of DEX volume. Per-victim slippage sits in the 5–40 bps range; the page uses the middle of that.',
    'Qin, Zhou, Gervais (arXiv 2022)',
    'https://arxiv.org/abs/2101.05511',
    'BLS-aggregated oracle consensus. No single peek.',
  ),
  make(
    'colocation', 10, 'Colocation latency edge',
    0.5, 1.0,
    0.4, 1.5,
    '0.5 bps peak × 1.0 trades affected = 0.5 bps per round-trip.',
    'Aquilina–Budish–O’Neill (QJE 2022) measured the global latency-arbitrage tax at ~0.5 bps of trading volume — about $5B/year on world equities. The page anchors directly to that figure.',
    'Aquilina–Budish–O’Neill (QJE 2022)',
    'https://academic.oup.com/qje/article/137/1/493/6368348',
    'No matching engine. Parimutuel pool.',
  ),
  make(
    'api-rate-ceiling', 11, 'API rate ceiling',
    0.5, 1.0,
    0, 3,
    '0.5 bps peak × 1.0 trades affected = 0.5 bps per round-trip.',
    'Binance publishes one global ceiling — 6,000 weight/min per IP, 100 orders / 10 s — and refuses to disclose institutional tiers. Whatever asymmetry exists is private; 0.5 bps is a placeholder, not a measurement.',
    'Binance API limits',
    'https://www.binance.com/en/support/faq/360004492232',
    'One rate, everyone. Pool resolves once per round.',
  ),
  make(
    'last-look', 12, 'Last-look quote rejection',
    2, 0.10,
    0.05, 0.45,
    '2 bps peak × 0.10 volatile fills = 0.2 bps per round-trip.',
    'Oomen (Quantitative Finance 2017) models reject rates of 8–28% on the adverse side with sub-pip asymmetric cost. The GFXC Execution Principles report on Last Look corroborates 5–15% rejection in industry practice.',
    'Oomen, "Last look", Quantitative Finance 2017',
    'https://eprints.lse.ac.uk/68811/1/Oomen_Last%20look_2017.pdf',
    'Sealed-bid auction. No rejection step.',
  ),
  make(
    'adl-visibility', 13, 'ADL / liquidation visibility',
    4, 0.001,
    0, 0.05,
    '4 bps peak × 0.001 cascade trades = 0.004 bps per round-trip.',
    'Forced-liquidation cascades are tail events. The Hyperliquid JELLY incident (March 2025, ~$13M at risk) shows what happens when liquidation logic and oracle inputs are visible enough to be gamed. The mechanism is real; the per-trade tax is small.',
    'Hyperliquid JELLY post-mortem (Halborn)',
    'https://www.halborn.com/blog/post/explained-the-hyperliquid-hack-march-2025',
    'No leverage. No forced liquidation.',
  ),
]
