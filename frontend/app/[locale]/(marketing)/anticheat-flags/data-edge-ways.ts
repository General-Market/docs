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
  /** One line: peak × frequency = effective. */
  conversion: string
  /** One line: why the frequency is what it is. */
  frequencyNote: string
  sourceLabel: string
  sourceUrl: string
  fix: string
}

/**
 * Fourteen mechanisms by which exchanges and market makers extract bps from retail.
 * Every value is amortized per round-trip: a rare-but-massive event is multiplied
 * by its trade-frequency, not pretended to fire every trade.
 *
 * Conversion rules (the only math in this section):
 *   - peakBps comes from a fee schedule, a latency conversion (ms × 0.05 bps/ms,
 *     Aquilina–Budish–O'Neill 2020), or a sourced adverse-selection study.
 *   - frequency is the probability the mechanism fires on a single retail trade
 *     at a venue where the mechanism is active. 1.0 = every trade.
 *   - bps = peakBps × frequency. That is the number used in the chart.
 *
 * Ranked descending by `bps` (effective per-trade cost).
 */
function make(
  slug: string,
  rank: number,
  name: string,
  peakBps: number,
  frequency: number,
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
    conversion,
    frequencyNote,
    sourceLabel,
    sourceUrl,
    fix,
  }
}

export const EDGE_WAYS: EdgeWay[] = [
  make(
    'b-book', 1, 'Internal book (b-book)',
    25, 1.0,
    '25 bps peak × 1.0 trades affected = 25 bps per round-trip.',
    'Every fill on a b-book venue is internalized against the broker. Frequency is one.',
    'FCA CP19/27',
    'https://www.fca.org.uk/publications/consultation-papers/cp19-27-restricting-contract-difference-products',
    'No internal book. The pool is the counterparty.',
  ),
  make(
    'pfof', 2, 'PFOF wholesaler markup',
    17, 1.0,
    '17 bps peak × 1.0 trades affected = 17 bps per round-trip.',
    'Every marketable order is sold to a wholesaler. Frequency is one.',
    'SEC Admin Proceeding 3-20171',
    'https://www.sec.gov/litigation/admin/2020/33-10906.pdf',
    'No order flow to sell. Bets post directly to the pool.',
  ),
  make(
    'vip-fee-tier', 3, 'VIP fee-tier subsidy',
    11, 1.0,
    '11 bps peak × 1.0 trades affected = 11 bps per round-trip.',
    'Fee deltas are deducted on every fill. Frequency is one.',
    'Binance VIP fee schedule',
    'https://www.binance.com/en/fee/schedule',
    'Flat fee. One tier.',
  ),
  make(
    'colocation', 4, 'Colocation latency edge',
    10, 1.0,
    '10 bps peak × 1.0 trades affected = 10 bps per round-trip.',
    'The MM is faster on every quote. Frequency is one.',
    'Aquilina–Budish–O’Neill 2020',
    'https://www.nber.org/papers/w27265',
    'No matching engine. Parimutuel pool.',
  ),
  make(
    'order-flow-vis', 5, 'Order-flow visibility',
    8, 1.0,
    '8 bps peak × 1.0 trades affected = 8 bps per round-trip.',
    'The book is visible to the MM at all times. Frequency is one.',
    'Hendershott & Riordan, JFQA 2013',
    'https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/algorithmic-trading-and-the-market-for-liquidity/9F8FDB1E47A4D5EC85CB6FE94CBC15B0',
    'Sealed bets. The book is private until the round resolves.',
  ),
  make(
    'maker-rebate', 6, 'Maker rebate / inverted fees',
    8, 1.0,
    '8 bps peak × 1.0 trades affected = 8 bps per round-trip.',
    'Rebates apply on every match. Frequency is one.',
    'Bloomberg · Kalshi class action',
    'https://www.bloomberg.com/news/articles/2025-11-28/kalshi-market-maker-bets-against-consumers-lawsuit-alleges',
    'No maker / taker model. One fee, whoever posts.',
  ),
  make(
    'cross-connect', 7, 'Designated cross-connect',
    7, 1.0,
    '7 bps peak × 1.0 trades affected = 7 bps per round-trip.',
    'The cross-connect is on for every fill the designated firm takes. Frequency is one.',
    'NYSE colocation lease',
    'https://www.nyse.com/markets/liquidity-programs',
    'No designated firms. No lane to lease.',
  ),
  make(
    'region-cluster', 8, 'AWS region clustering',
    5, 1.0,
    '5 bps peak × 1.0 trades affected = 5 bps per round-trip.',
    'Geography is constant. Frequency is one.',
    'Glassnode · Coindesk March 2026',
    'https://www.coindesk.com/markets/2026/03/30/hyperliquid-traders-in-tokyo-get-200-millisecond-edge-glassnode-research-shows',
    'Global pricing function. Geography is not an input.',
  ),
  make(
    'api-rate-ceiling', 9, 'API rate ceiling',
    3, 1.0,
    '3 bps peak × 1.0 trades affected = 3 bps per round-trip.',
    'The rate gap is constant. Frequency is one.',
    'Binance API limits',
    'https://www.binance.com/en/support/faq/360004492232',
    'One rate, everyone. Pool resolves once per round.',
  ),
  make(
    'last-look', 10, 'Last-look quote rejection',
    6, 0.15,
    '6 bps peak × 0.15 volatile fills = 0.9 bps per round-trip.',
    'Rejection asymmetry triggers on volatile fills only. FCA estimates ~15% of fills sit in the asymmetric window.',
    'FCA MS17/1',
    'https://www.fca.org.uk/publications/market-studies/wholesale-banking',
    'Sealed-bid auction. No rejection step.',
  ),
  make(
    'oracle-peek', 11, 'Oracle / price-feed peek',
    12, 0.05,
    '12 bps peak × 0.05 price-sensitive ticks = 0.6 bps per round-trip.',
    'Oracle adverse selection only fires around resolution and settlement events, roughly 5% of trade time.',
    'Eskandari et al. · SoK Transparent Dishonesty',
    'https://arxiv.org/abs/1902.05164',
    'BLS-aggregated oracle consensus. No single peek.',
  ),
  make(
    'listing-frontrun', 12, 'Listing front-running',
    30, 0.002,
    '30 bps peak × 0.002 affected trades = 0.06 bps per round-trip.',
    'Argus 2022: 46 wallets affected $17.3M of buys against billions in venue daily volume. Per-trade incidence ≈ 0.2%.',
    'Argus / Fortune',
    'https://fortune.com/crypto/2022/05/23/binance-ceo-changpeng-zhao-crypto-insider-trading-twitter-frontrunning/',
    'Sealed bets resolved by BLS oracle. No listing pipeline to leak.',
  ),
  make(
    'adl-visibility', 13, 'ADL / liquidation visibility',
    4, 0.001,
    '4 bps peak × 0.001 cascade trades = 0.004 bps per round-trip.',
    'Forced-liquidation cascades are tail events; the JELLY post-mortem traces back to a single-figure number of cascades per year.',
    'Hyperliquid JELLY post-mortem',
    'https://hyperliquid.gitbook.io/hyperliquid-docs/risks',
    'No leverage. No forced liquidation.',
  ),
  make(
    'insurance-priority', 14, 'Insurance-fund priority',
    2, 0.001,
    '2 bps peak × 0.001 cascade trades = 0.002 bps per round-trip.',
    'Insurance-fund priority is only consumed during cascades. Same tail frequency as ADL.',
    'Binance insurance-fund mechanics',
    'https://www.binance.com/en/support/faq/115001220371',
    'No insurance fund needed. No leverage to insure.',
  ),
]
