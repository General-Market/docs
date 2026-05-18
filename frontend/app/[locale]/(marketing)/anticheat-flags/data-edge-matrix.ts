export type EdgeCategory = 'information' | 'latency' | 'execution' | 'subsidy' | 'risk'

export interface EdgeSource {
  label: string
  url: string
}

export interface EdgeRow {
  slug: string
  category: EdgeCategory
  name: string
  /** Short uppercase pill — keep under ~16 chars. */
  tag: string
  /** Total magnitude of the edge in its native unit. */
  value: number
  /** Native unit appended to value in the right-rail label. */
  unit: string
  /** Portion of the total that is truly gated (contract, capital, employment, dealer balance sheet). */
  gatedValue: number
  /** "A vs B" line under the row in the attribution grid. */
  lane: string
  /** One phrase naming what gates the gated portion. */
  barrier: string
  sources: EdgeSource[]
}

export const CATEGORY_LABEL: Record<EdgeCategory, string> = {
  information: 'Information',
  latency: 'Latency',
  execution: 'Execution',
  subsidy: 'Subsidy',
  risk: 'Risk',
}

export const CATEGORY_HEADING: Record<EdgeCategory, string> = {
  information: 'What the desk knows before you do.',
  latency: 'How many microseconds closer the inside lane sits.',
  execution: 'Which rule the matching engine actually plays by.',
  subsidy: 'The fees flow back to the people who do not pay them.',
  risk: 'The liquidator, the auto-deleverager, the late print.',
}

export const CATEGORY_LEAD: Record<EdgeCategory, string> = {
  information:
    'Solid bar = portion truly gated (employment at the listing desk, dealer book access, PFOF contract, ultra-low-latency vendor deal). Faded bar = portion an outsider can reach with a $99 retail subscription or a public press release timer. The numbers under each row name how much of the asymmetry has no retail price at all.',
  latency:
    'Solid bar = portion behind a real barrier — direct-feed seat, private builder relay, prime-broker FX tier. Faded bar = portion anyone with a cloud VPS or open-source searcher can reach. The unit changes per row because the underlying mechanism does; the labels carry the truth.',
  execution:
    'Solid bar = portion gated by capital, designated-MM contract, or VIP-tier allocation. Faded bar = portion technically open to anyone — knowing which algo a product uses, having a Coinbase account, watching the funding clock. Knowing the rule is free. Playing the rule costs the room rent.',
  subsidy:
    'Solid bar = portion gated by volume threshold, DMM contract, or pool dominance. Faded bar = the public docs that publish the formula. Anyone can read the rebate page. Almost no one collects.',
  risk:
    'Solid bar = portion gated by being the dealer, the HLP vault, or the bilateral counterparty. Faded bar = the public rule that allows the asymmetry. The rule is in the help center. The contract is not.',
}

export const EDGE_ROWS: EdgeRow[] = [
  // ─── INFORMATION ─────────────────────────────────────────────────────────
  {
    slug: 'listing-frontrun',
    category: 'information',
    name: 'Listing front-running',
    tag: 'Insider memo',
    value: 1.5,
    unit: '$M tipped',
    gatedValue: 1.5,
    lane: 'Wahi (Coinbase PM) and tippees vs retail watching the listing tweet',
    barrier: 'Employment at the listing-decision desk — or a phone call from someone employed there',
    sources: [
      { label: 'DOJ · Wahi sentenced', url: 'https://www.justice.gov/usao-sdny/pr/former-coinbase-insider-sentenced-first-ever-cryptocurrency-insider-trading-case' },
      { label: 'SEC · Wahi settlement', url: 'https://www.sec.gov/newsroom/press-releases/2023-98' },
    ],
  },
  {
    slug: 'preprint-data',
    category: 'information',
    name: 'Pre-print data wire',
    tag: 'Private wire',
    value: 2,
    unit: 's head-start',
    gatedValue: 2,
    lane: 'Thomson Reuters ULL subscribers vs the 9:55:00 public release timer',
    barrier: 'Ultra-low-latency vendor contract — historically six-figure annual subscription; the practice was litigated, not democratized',
    sources: [
      { label: 'CNBC · Reuters early advantage', url: 'https://www.cnbc.com/2013/06/12/thomson-reuters-gives-elite-traders-early-advantage.html' },
      { label: 'NY AG · Schneiderman Insider Trading 2.0', url: 'https://ag.ny.gov/press-release/2014/ag-schneiderman-applauds-deal-between-university-michigan-and-bloomberg-ending' },
    ],
  },
  {
    slug: 'dealer-gamma',
    category: 'information',
    name: 'Dealer gamma map',
    tag: 'Gamma book',
    value: 1999,
    unit: '$/mo retail tier',
    gatedValue: 1999,
    lane: 'Citadel/SIG/Optiver internal book vs SpotGamma retail subscriber',
    barrier: 'Be the dealer; the unaggregated book is not sold at any price. The $1,999/mo SpotGamma tier is a partial reconstruction',
    sources: [
      { label: 'SpotGamma · plans & pricing', url: 'https://spotgamma.com/subscribe-to-spotgamma/' },
      { label: 'CBOE · 0DTE & market volatility', url: 'https://cdn.cboe.com/resources/education/research_publications/gammasqueezes.pdf' },
    ],
  },
  {
    slug: 'pfof-orderflow',
    category: 'information',
    name: 'PFOF / retail order flow',
    tag: 'PFOF deal',
    value: 1190,
    unit: '$M / quarter',
    gatedValue: 1190,
    lane: 'Citadel · Virtu · Susquehanna vs lit-market participants',
    barrier: 'Wholesaler agreement with a retail broker — capital, prime relationships, FINRA registration; no retail equivalent',
    sources: [
      { label: 'Global Trading · Q1 2025 PFOF record', url: 'https://www.globaltrading.net/payment-for-us-retail-flow-reaches-record-high-led-by-citadel-securities-imc/' },
      { label: 'SEC · GameStop staff report', url: 'https://www.sec.gov/files/staff-report-equity-options-market-struction-conditions-early-2021.pdf' },
    ],
  },

  // ─── LATENCY ─────────────────────────────────────────────────────────────
  {
    slug: 'mev-mempool',
    category: 'latency',
    name: 'MEV / mempool',
    tag: 'Private relay',
    value: 1380,
    unit: '$M extracted',
    gatedValue: 1100,
    lane: 'Top searchers with private builder relays vs public-mempool users',
    barrier: 'Validator-relay partnership + sub-block simulation infra. Defensive private mempool (MEV Blocker) is free but does not capture',
    sources: [
      { label: 'EigenPhi MEV scanner', url: 'https://eigenphi.io/' },
      { label: 'Flashbots MEV-Boost dashboard', url: 'https://dashboard.flashbots.net/' },
      { label: 'Daian et al. — Flash Boys 2.0', url: 'https://arxiv.org/abs/1904.05234' },
    ],
  },
  {
    slug: 'sip-vs-direct-feed',
    category: 'latency',
    name: 'SIP vs. direct feed',
    tag: 'Direct feed',
    value: 500,
    unit: 'µs gap',
    gatedValue: 500,
    lane: 'NASDAQ ITCH cross-connect vs SIP arriving through the broker',
    barrier: '$5,280/mo direct-feed seat + Equinix cross-connect + colocated cabinet — every piece priced for institutions',
    sources: [
      { label: 'Databento · proprietary feeds vs SIPs', url: 'https://databento.com/blog/proprietary-feeds-vs-sip-data' },
      { label: 'NASDAQ US Equities Price List 2025', url: 'https://www.nasdaqtrader.com/content/ProductsServices/PriceList/Nasdaq_US_Equities_Price_List_2025.pdf' },
      { label: 'Bartlett & McCrary — Berkeley Law', url: 'https://www.law.berkeley.edu/wp-content/uploads/archive/2019/10/bartlett_mccrary_latency2017.pdf' },
    ],
  },
  {
    slug: 'last-look-quote-fade',
    category: 'latency',
    name: 'Last look & phantom liquidity',
    tag: 'Asym hold',
    value: 50,
    unit: 'ms hold',
    gatedValue: 50,
    lane: 'Prime-broker LP rejecting orders vs retail click-trader',
    barrier: 'Disclosed-streaming LP role under FX Global Code — principle 17 lets only the LP hold the order for re-pricing',
    sources: [
      { label: 'BIS Quarterly Review · FX execution', url: 'https://www.bis.org/publ/qtrpdf/r_qt1912g.htm' },
      { label: 'Global FX Committee · Last Look', url: 'https://www.globalfxc.org/press-releases/press-p210818/' },
      { label: 'ESMA WP 4/2020 · ghost liquidity', url: 'https://www.esma.europa.eu/sites/default/files/library/esma_wp_4_2020_hft_and_ghost_liquidity.pdf' },
    ],
  },

  // ─── EXECUTION ───────────────────────────────────────────────────────────
  {
    slug: 'matching-algo-fifo-prorata',
    category: 'execution',
    name: 'Matching algorithm',
    tag: 'Algo choice',
    value: 8,
    unit: 'algos in use',
    gatedValue: 6,
    lane: 'LMM with contractual allocation slice vs price-time market order',
    barrier: 'LMM contract — capital + venue agreement. Pro-rata products favor capital; FIFO products favor sub-ms infra. Retail has neither',
    sources: [
      { label: 'CME · supported matching algorithms', url: 'https://www.cmegroup.com/confluence/display/EPICSANDBOX/Supported+Matching+Algorithms' },
      { label: 'Databento · CME matching algorithms', url: 'https://databento.com/blog/cme-matching-algorithms-explained' },
    ],
  },
  {
    slug: 'cancel-priority',
    category: 'execution',
    name: 'Cancel priority',
    tag: 'Colo cancel',
    value: 95,
    unit: '% cancelled',
    gatedValue: 95,
    lane: 'Colocated MM with cancel-first FIX vs retail order arriving late',
    barrier: 'Same cabinet + dedicated cancel gateway. The CFTC "good-faith cancellation" carve-out is the loophole all of it lives in',
    sources: [
      { label: 'SEC · Equity Market Structure Concept Release', url: 'https://www.sec.gov/files/rules/concept/2010/34-61358.pdf' },
      { label: 'CFTC Antidisruptive Practices guidance', url: 'https://www.federalregister.gov/documents/2013/05/28/2013-12365/antidisruptive-practices-authority' },
      { label: 'CME Rule 575 — disruptive practices', url: 'https://www.cmegroup.com/rulebook/files/cme-group-Rule-575.pdf' },
    ],
  },
  {
    slug: 'api-rate-limit-tiers',
    category: 'execution',
    name: 'API rate-limit tiers',
    tag: 'VIP tier',
    value: 100,
    unit: 'req/s ceiling',
    gatedValue: 70,
    lane: 'Coinbase Prime / Binance VIP 1+ vs retail Advanced Trade',
    barrier: '$500M+ 30-day volume or Prime onboarding. The 30 req/s retail floor is the same matching engine, smaller door',
    sources: [
      { label: 'Coinbase Prime · rate limits', url: 'https://docs.cdp.coinbase.com/prime/rest-api/rate-limits' },
      { label: 'Coinbase Advanced Trade · rate limits', url: 'https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/rest-api/rate-limits' },
      { label: 'Binance Futures · rate-limit FAQ', url: 'https://www.binance.com/en/support/faq/rate-limits-on-binance-futures-281596e222414cdd9051664ea621cdc3' },
    ],
  },
  {
    slug: 'funding-boundary-arb',
    category: 'execution',
    name: 'Funding-boundary arbitrage',
    tag: 'Boundary clock',
    value: 0.75,
    unit: '% per 8h cycle',
    gatedValue: 0.6,
    lane: 'Low-latency boundary bots vs retail funding-rate carry',
    barrier: 'Sub-second multi-venue execution stack + capital + clock-aligned hedge unwind. The clock itself is public; the timing is not',
    sources: [
      { label: 'Hyperliquid · funding docs', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding' },
      { label: 'Binance · funding arbitrage FAQ', url: 'https://www.binance.com/en/support/faq/how-to-use-the-funding-rate-arbitrage-on-binance-futures-61012e690cf343e7979649282a2ccc3c' },
      { label: 'BitMEX 2025 Q3 derivatives report', url: 'https://www.bitmex.com/blog/2025q3-derivatives-report' },
    ],
  },

  // ─── SUBSIDY ─────────────────────────────────────────────────────────────
  {
    slug: 'mm-subsidy',
    category: 'subsidy',
    name: 'Market-maker subsidy pool',
    tag: 'Rebate pool',
    value: 25,
    unit: '% taker fees recycled',
    gatedValue: 22,
    lane: 'Polymarket top makers / Kalshi DMM Susquehanna vs retail taker',
    barrier: 'Pro-rata pool dominance (Polymarket) or DMM contract (Kalshi, private). The formula is public; the recipients are not',
    sources: [
      { label: 'Polymarket · maker rebates', url: 'https://docs.polymarket.com/polymarket-learn/trading/maker-rebates-program' },
      { label: 'Pelayo et al. v. Kalshi — complaint', url: 'https://www.classaction.org/media/pelayo-et-al-v-kalshi-inc-et-al-complaint.pdf' },
      { label: 'Susquehanna becomes Kalshi DMM', url: 'https://www.businesswire.com/news/home/20240403664852/en/Kalshi-Onboards-Its-First-Dedicated-Institutional-Market-Maker' },
    ],
  },
  {
    slug: 'maker-rebate-cross-venue',
    category: 'subsidy',
    name: 'Maker-fee flip',
    tag: 'Tier flip',
    value: 18,
    unit: 'bps per side',
    gatedValue: 18,
    lane: 'Hyperliquid Tier 6+ / Binance VIP 9 maker vs retail Tier 0',
    barrier: '>3% of total maker volume (Hyperliquid) or $30B/30d futures (Binance VIP 9). Same maker order; opposite invoice',
    sources: [
      { label: 'Hyperliquid · fees', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees' },
      { label: 'Binance · USDⓈ-M futures fees', url: 'https://www.binance.com/en/fee/futureFee' },
      { label: 'Bybit · MM incentive program', url: 'https://www.bybit.com/en/help-center/article/Introduction-to-the-Market-Maker-Incentive-Program' },
    ],
  },

  // ─── RISK ────────────────────────────────────────────────────────────────
  {
    slug: 'liquidation-engine',
    category: 'risk',
    name: 'Liquidation engine',
    tag: 'HLP / BLP',
    value: 2270,
    unit: '$M in 24h',
    gatedValue: 2270,
    lane: 'HLP vault depositors / Alameda BLP vs the liquidated trader',
    barrier: 'Vault capital threshold (Hyperliquid HLP) or a "secret exemption" from the auto-liquidator (Alameda, per SEC v. Ellison)',
    sources: [
      { label: 'Hyperliquid · liquidations', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations' },
      { label: 'Coinglass · liquidations dashboard', url: 'https://www.coinglass.com/LiquidationData' },
      { label: 'SEC v. Caroline Ellison', url: 'https://www.sec.gov/enforcement-litigation/litigation-releases/lr-26450' },
    ],
  },
  {
    slug: 'block-trade-reporting-delay',
    category: 'risk',
    name: 'Block-trade reporting delay',
    tag: 'Late print',
    value: 48,
    unit: 'h delay',
    gatedValue: 48,
    lane: 'The dealer who absorbed the block vs everyone reading the tape',
    barrier: 'Be the block dealer. FINRA 19-12 caps TRACE size and proposes a 48-hour delay on bonds above $10M IG / $5M HY — by rule, not by tier',
    sources: [
      { label: 'FINRA Rule 6750', url: 'https://www.finra.org/rules-guidance/rulebooks/finra-rules/6750' },
      { label: 'FINRA Reg Notice 19-12', url: 'https://www.finra.org/rules-guidance/notices/19-12' },
      { label: 'SEC · OPRA Plan', url: 'https://www.sec.gov/rules-regulations/2000/11/options-price-reporting-authority' },
    ],
  },
]
