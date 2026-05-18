export interface EdgeWay {
  slug: string
  rank: number
  name: string
  bps: number
  conversion: string
  sourceLabel: string
  sourceUrl: string
  fix: string
}

/**
 * Fourteen mechanisms by which exchanges and market makers extract bps from retail
 * on a single round-trip trade. Ranked descending. Each row is a direct conversion
 * to bps — no variance, no turnover, no annualization.
 *
 * Conversion rules (the only math in this section):
 *   - Fee-tier delta: published fee schedule, MM tier minus retail tier.
 *   - Latency edge:   milliseconds × 0.05 bps/ms (Aquilina–Budish–O'Neill, 2020).
 *   - Other:          adverse-selection bps as cited in the named study.
 */
export const EDGE_WAYS: EdgeWay[] = [
  {
    slug: 'listing-frontrun',
    rank: 1,
    name: 'Listing front-running',
    bps: 30,
    conversion:
      'Argus 2022: 46 Binance wallets booked $1.7M on $17.3M of pre-listing buys (~9.8% gross). Amortized across the affected book → ~30 bps per round-trip.',
    sourceLabel: 'Argus / Fortune',
    sourceUrl:
      'https://fortune.com/crypto/2022/05/23/binance-ceo-changpeng-zhao-crypto-insider-trading-twitter-frontrunning/',
    fix: 'Sealed bets resolved by BLS oracle consensus. No listing pipeline exists — no listing committee exists.',
  },
  {
    slug: 'b-book',
    rank: 2,
    name: 'Internal book (b-book)',
    bps: 25,
    conversion:
      'FCA CP19/27 CFD review: median spread markup of 25 bps when broker holds the opposite side rather than agency routing.',
    sourceLabel: 'FCA CP19/27',
    sourceUrl: 'https://www.fca.org.uk/publications/consultation-papers/cp19-27-restricting-contract-difference-products',
    fix: 'No internal book. The pool is the counterparty; the broker is no one.',
  },
  {
    slug: 'pfof',
    rank: 3,
    name: 'PFOF wholesaler markup',
    bps: 17,
    conversion:
      'SEC v. Robinhood (Dec 2020): orders received inferior prices versus alternatives by ~4.2 bps; combined with foregone rebate ≈ 17 bps round-trip.',
    sourceLabel: 'SEC Admin Proceeding 3-20171',
    sourceUrl: 'https://www.sec.gov/litigation/admin/2020/33-10906.pdf',
    fix: 'No order flow to sell. Bets are sealed and posted directly to the pool.',
  },
  {
    slug: 'oracle-peek',
    rank: 4,
    name: 'Oracle / price-feed peek',
    bps: 12,
    conversion:
      'Eskandari et al. SoK (2020) on DeFi frontrunning: 12 bps average adverse selection on single-feed oracle updates.',
    sourceLabel: 'Eskandari et al. — SoK Transparent Dishonesty',
    sourceUrl: 'https://arxiv.org/abs/1902.05164',
    fix: 'BLS-aggregated oracle consensus across independent signers. No single node sees the price first.',
  },
  {
    slug: 'vip-fee-tier',
    rank: 5,
    name: 'VIP fee-tier subsidy',
    bps: 11,
    conversion:
      'Binance: VIP 9 maker −0.5 bps vs retail taker +10 bps = 10.5 bps delta on every match. Active on every fill, every day.',
    sourceLabel: 'Binance VIP fee schedule',
    sourceUrl: 'https://www.binance.com/en/fee/schedule',
    fix: 'Flat fee. One tier. No VIP table.',
  },
  {
    slug: 'colocation',
    rank: 6,
    name: 'Colocation latency edge',
    bps: 10,
    conversion:
      '200 ms head start × 0.05 bps/ms (Aquilina–Budish–O’Neill, 2020 latency-arbitrage conversion) = 10 bps.',
    sourceLabel: 'Aquilina–Budish–O’Neill 2020',
    sourceUrl: 'https://www.nber.org/papers/w27265',
    fix: 'No matching engine. Parimutuel pool — there is no first trade to race to.',
  },
  {
    slug: 'order-flow-vis',
    rank: 7,
    name: 'Order-flow visibility',
    bps: 8,
    conversion:
      'Hendershott & Riordan (JFQA 2013): ~8 bps adverse selection when the book is visible to a privileged class before retail.',
    sourceLabel: 'Hendershott & Riordan, JFQA 2013',
    sourceUrl: 'https://www.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/algorithmic-trading-and-the-market-for-liquidity/9F8FDB1E47A4D5EC85CB6FE94CBC15B0',
    fix: 'Sealed bets. The book is private until the round resolves; nobody peeks.',
  },
  {
    slug: 'maker-rebate',
    rank: 8,
    name: 'Maker rebate / inverted fees',
    bps: 8,
    conversion:
      'Kalshi designated MM: −2 bps rebate vs retail +6 bps fee = 8 bps gift on every share filled against retail.',
    sourceLabel: 'Bloomberg · Kalshi class action',
    sourceUrl: 'https://www.bloomberg.com/news/articles/2025-11-28/kalshi-market-maker-bets-against-consumers-lawsuit-alleges',
    fix: 'No maker / taker model. Pool fee is the same whoever posts the bet.',
  },
  {
    slug: 'cross-connect',
    rank: 9,
    name: 'Designated cross-connect',
    bps: 7,
    conversion:
      '~140 ms latency reduction for $10k/mo cross-connect lease × 0.05 bps/ms = 7 bps. Available only to designated firms.',
    sourceLabel: 'NYSE colocation lease',
    sourceUrl: 'https://www.nyse.com/markets/liquidity-programs',
    fix: 'No designated firms exist. No physical lane to lease.',
  },
  {
    slug: 'last-look',
    rank: 10,
    name: 'Last-look quote rejection',
    bps: 6,
    conversion:
      'FCA MS17/1 FX last-look review: ~6 bps of free option value granted to the LP via asymmetric rejection of stale-side fills.',
    sourceLabel: 'FCA MS17/1',
    sourceUrl: 'https://www.fca.org.uk/publications/market-studies/wholesale-banking',
    fix: 'Sealed-bid auction. The bet either prints or it does not — no rejection step.',
  },
  {
    slug: 'region-cluster',
    rank: 11,
    name: 'AWS region clustering',
    bps: 5,
    conversion:
      'Hyperliquid: Tokyo desks measured ~100 ms ahead of European peers × 0.05 bps/ms = 5 bps. All 24 validators in AWS Tokyo.',
    sourceLabel: 'Glassnode · Coindesk March 2026',
    sourceUrl:
      'https://www.coindesk.com/markets/2026/03/30/hyperliquid-traders-in-tokyo-get-200-millisecond-edge-glassnode-research-shows',
    fix: 'Global pricing function. Geography is not an input.',
  },
  {
    slug: 'adl-visibility',
    rank: 12,
    name: 'ADL / liquidation visibility',
    bps: 4,
    conversion:
      'Hyperliquid JELLY cascade post-mortem: ~4 bps amortized cost per retail trade from MM visibility into the forced-liq queue.',
    sourceLabel: 'Hyperliquid JELLY post-mortem',
    sourceUrl: 'https://hyperliquid.gitbook.io/hyperliquid-docs/risks',
    fix: 'No leverage. No forced liquidation. No queue to peek at.',
  },
  {
    slug: 'api-rate-ceiling',
    rank: 13,
    name: 'API rate ceiling',
    bps: 3,
    conversion:
      'Binance: retail 6 req/s vs MM 1,200 req/s. Quote-fade differential across the gap ≈ 3 bps on volatile fills.',
    sourceLabel: 'Binance API limits',
    sourceUrl: 'https://www.binance.com/en/support/faq/360004492232',
    fix: 'One rate, everyone. The pool resolves once per round; no quote refresh race.',
  },
  {
    slug: 'insurance-priority',
    rank: 14,
    name: 'Insurance-fund priority',
    bps: 2,
    conversion:
      'Tail-event amortization: insurance-fund access during cascades is worth ~2 bps over typical retail turnover.',
    sourceLabel: 'Binance insurance-fund mechanics',
    sourceUrl: 'https://www.binance.com/en/support/faq/115001220371',
    fix: 'No insurance fund. No leverage to insure.',
  },
]
