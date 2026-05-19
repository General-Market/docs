export type EdgeCategory = 'information' | 'latency' | 'execution' | 'subsidy' | 'risk'

export interface EdgeSource {
  label: string
  url: string
}

export interface CompanyRow {
  slug: string
  /** Venue display name only. No suffix, no incident title, no year. */
  name: string
  /** Short uppercase pill. Keep under ~22 chars. */
  tag: string
  /** Magnitude of the MM advantage over retail in the topic's shared unit. Retail = 0 baseline. */
  value: number
  /** Retained for type compatibility. Renderer ignores. */
  gatedValue: number
  /** One-line "Retail: X | MM: Y" comparison. */
  lane: string
  /** Single short mechanism noun phrase. */
  barrier: string
  sources: EdgeSource[]
  /** Retained for type compatibility. No longer used after row collapse. */
  group?: string
}

export interface EdgeTopic {
  slug: string
  category: EdgeCategory
  name: string
  /** H3 above the chart. The knife sentence. */
  heading: string
  /** Lead paragraph below the heading. Explains the unit and the MM-vs-retail gap. */
  lead: string
  /** Shared unit string. Every row's value is in this unit. */
  unit: string
  /** "No edge" caption shown on the General Market row. */
  generalMarketLabel: string
  rows: CompanyRow[]
}

export const CATEGORY_LABEL: Record<EdgeCategory, string> = {
  information: 'Information',
  latency: 'Latency',
  execution: 'Execution',
  subsidy: 'Subsidy',
  risk: 'Risk',
}

export const EDGE_TOPICS: EdgeTopic[] = [
  // ─── INFORMATION ────────────────────────────────────────────────────────
  {
    slug: 'listing-frontrun',
    category: 'information',
    name: 'Listing front-running',
    heading: 'Unfair listing front-running',
    lead: 'Retail baseline = 0. Bar = USD millions of insider profit on a documented pre-listing trade at this venue.',
    unit: '$M insider profit (documented)',
    generalMarketLabel: 'A leaked listing tells you nothing about the ninety-nine others sealed in the same block.',
    rows: [
      {
        slug: 'pumpfun-sniper-month',
        name: 'Pump.fun',
        tag: 'Bitget 2025',
        value: 2.5,
        gatedValue: 2.5,
        lane: 'Retail: 0 | MM: $2.5M (4,600 sniper wallets, >15,000 SOL extracted in one month, 87% profitability)',
        barrier: 'Jito bundles + 0-slot RPC',
        sources: [
          { label: 'Bitget News · Liquidity Sniping on Pump.fun', url: 'https://www.bitget.com/news/detail/12560604803448' },
          { label: 'GitHub · cicere/pumpfun-bundler', url: 'https://github.com/cicere/pumpfun-bundler' },
        ],
      },
      {
        slug: 'coinbase-wahi-ramani',
        name: 'Coinbase',
        tag: 'SEC LR-25947',
        value: 2.45,
        gatedValue: 2.45,
        lane: 'Retail: 0 | MM: $2.45M (PM Ishan Wahi tipped ≥9 forthcoming listings; Ramani twice-the-proceeds judgment)',
        barrier: 'PM-level access to the listing pipeline',
        sources: [
          { label: 'SEC v. Wahi. Litigation Release LR-25947', url: 'https://www.sec.gov/enforcement-litigation/litigation-releases/lr-25947' },
        ],
      },
      {
        slug: 'binance-listings-argus',
        name: 'Binance',
        tag: 'Argus 2022',
        value: 1.7,
        gatedValue: 1.7,
        lane: 'Retail: 0 | MM: $1.7M (46 wallets bought $17.3M before listings, walked away with $1.7M)',
        barrier: 'Internal listing-pipeline access',
        sources: [
          { label: 'Fortune · CZ on zero-tolerance leaks', url: 'https://fortune.com/crypto/2022/05/23/binance-ceo-changpeng-zhao-crypto-insider-trading-twitter-frontrunning/' },
        ],
      },
    ],
  },
  {
    slug: 'dealer-gamma',
    category: 'information',
    name: 'Dealer flow visibility',
    heading: 'Unfair dealer flow visibility',
    lead: 'Retail baseline = 0. Bar = 0-10 score of how much of the order book the MM or affiliated desk sees. 10 = full book + named-MM access + B-book counterparty.',
    unit: 'score 0-10 (MM flow visibility)',
    generalMarketLabel: 'Orders are hashed before reveal. Even the oracle nodes are blind until the batch closes.',
    rows: [
      {
        slug: 'etoro-principal-book',
        name: 'eToro',
        tag: 'Principal CFD book',
        value: 10,
        gatedValue: 10,
        lane: 'Retail: 0 | MM: 10/10 ("conducts trading predominantly as principal". Every CFD position is a liability on its book)',
        barrier: 'Broker is the dealer',
        sources: [
          { label: 'eToro Group Ltd · Form 20-F FY2024', url: 'https://www.stocktitan.net/sec-filings/ETOR/20-f-e-toro-group-ltd-files-annual-report-foreign-issuer-d3aa075c81bc.html' },
          { label: 'ASIC 23-204MR · eToro CFD action', url: 'https://www.asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-204mr-asic-sues-etoro-in-its-first-design-and-distribution-action-to-protect-consumers-from-high-risk-cfd-products/' },
        ],
      },
      {
        slug: 'binance-sigma-chain',
        name: 'Binance',
        tag: 'SEC complaint 2023',
        value: 9,
        gatedValue: 9,
        lane: 'Retail: 0 | MM: 9/10 (Zhao-owned Sigma Chain. Internal "main MM"; Merit Peak received >$22B commingled flow)',
        barrier: 'Co-owned exchange + prop desk',
        sources: [
          { label: 'SEC v. Binance. Complaint', url: 'https://www.sec.gov/files/litigation/complaints/2023/comp-pr2023-101.pdf' },
        ],
      },
      {
        slug: 'robinhood-citadel-internalize',
        name: 'Robinhood',
        tag: '~40% US retail equities',
        value: 9,
        gatedValue: 9,
        lane: 'Retail: 0 | MM: 9/10 (Citadel Securities reads ~40% of US retail equity flow before any exchange does)',
        barrier: 'PFOF contract with wholesaler',
        sources: [
          { label: 'Congressional Research Service · PFOF and Broker-Dealer Regulation', url: 'https://www.congress.gov/crs-product/IF12594' },
        ],
      },
      {
        slug: 'polymarket-operator-book',
        name: 'Polymarket',
        tag: 'CTF Exchange operator',
        value: 8,
        gatedValue: 8,
        lane: 'Retail: 0 | MM: 8/10 (single operator address has exclusive matchOrders authority. Sees the queue first)',
        barrier: 'Operator role on CTF Exchange',
        sources: [
          { label: 'CFTC Press Release 8478-22 · Blockratize/Polymarket settlement', url: 'https://www.cftc.gov/PressRoom/PressReleases/8478-22' },
          { label: 'Polymarket CTF Exchange · Overview.md', url: 'https://github.com/Polymarket/ctf-exchange/blob/main/docs/Overview.md' },
        ],
      },
      {
        slug: 'hyperliquid-hlp-jelly',
        name: 'Hyperliquid',
        tag: 'HLP validator vault',
        value: 8,
        gatedValue: 8,
        lane: 'Retail: 0 | MM: 8/10 (HLP runs on every validator node; JELLY inherited as $13.5M loss, voted closed at $0.0095)',
        barrier: 'Backstop and referee share an address space',
        sources: [
          { label: 'CoinDesk · Hyperliquid delists JELLY', url: 'https://www.coindesk.com/markets/2025/03/26/hyperliquid-delists-jellyjelly-after-vault-squeezed-in-usd13m-tussle' },
        ],
      },
      {
        slug: 'coinbase-prime-rfq',
        name: 'Coinbase',
        tag: 'Prime RFQ desk',
        value: 7,
        gatedValue: 7,
        lane: 'Retail: 0 | MM: 7/10 (Prime brokerage with bilateral RFQ + Liquidity Pool overlay reads inquiry before book)',
        barrier: 'Prime onboarding + capital minimums',
        sources: [
          { label: 'Coinbase Prime · How it works', url: 'https://prime.coinbase.com/' },
        ],
      },
      {
        slug: 'kalshi-sig-mm',
        name: 'Kalshi',
        tag: 'SIG DMM since 2024',
        value: 6,
        gatedValue: 6,
        lane: 'Retail: 0 | MM: 6/10 (SIG dedicated DMM provides "close to 30×" prior liquidity; sees book first)',
        barrier: 'Dedicated MM contract',
        sources: [
          { label: 'Business Wire · Kalshi-SIG announcement', url: 'https://www.businesswire.com/news/home/20240403664852/en/Kalshi-Onboards-Its-First-Dedicated-Institutional-Market-Maker' },
        ],
      },
      {
        slug: 'pumpfun-rug-cluster',
        name: 'Pump.fun',
        tag: 'Serial deployer cluster',
        value: 6,
        gatedValue: 6,
        lane: 'Retail: 0 | MM: 6/10 (12 deployer clusters launched ~320 tokens each; one wallet alone created 29,834 tokens, $3.8M exit)',
        barrier: 'Deployer identity hidden',
        sources: [
          { label: 'Abdul · Serial Rug Deployers on Pump.fun', url: 'https://medium.com/@abubakarabdulfattah120/serial-rug-deployers-on-pump-fun-a-deep-dive-into-solanas-meme-coin-laundromat-a57ddda190cc' },
        ],
      },
      {
        slug: 'bybit-otc-rfq',
        name: 'Bybit',
        tag: '$50k-$5M clips',
        value: 5,
        gatedValue: 5,
        lane: 'Retail: 0 | MM: 5/10 (institutional OTC RFQ desk sees $50k-$5M ticket intent before the book)',
        barrier: 'Institutional OTC onboarding',
        sources: [
          { label: 'Bybit OTC FAQ', url: 'https://www.bybit.com/en/help-center/article/FAQ-Bybit-OTC' },
        ],
      },
      {
        slug: 'deribit-block-rfq',
        name: 'Deribit',
        tag: 'Block RFQ whitelist',
        value: 4,
        gatedValue: 4,
        lane: 'Retail: 0 | MM: 4/10 (Block RFQ. Taker selects which MMs see the inquiry; only whitelisted MMs read it)',
        barrier: 'MM whitelist',
        sources: [
          { label: 'CoinDesk · Deribit launches Block RFQ', url: 'https://www.coindesk.com/markets/2025/03/06/deribit-launches-block-rfq-system-to-improve-liquidity-for-large-over-the-counter-trades' },
        ],
      },
      {
        slug: 'ibkr-timber-hill-wound-down',
        name: 'IBKR',
        tag: 'Timber Hill wound down 2017',
        value: 2,
        gatedValue: 2,
        lane: 'Retail: 0 | MM: 2/10 (in-house MM Timber Hill wound down 2017; SmartRouter still reads client routing data)',
        barrier: 'Self-imposed. Affiliated dealer is gone',
        sources: [
          { label: 'Bloomberg · Timber Hill wind-down', url: 'https://www.bloomberg.com/news/articles/2017-05-16/interactive-brokers-says-it-s-shutting-its-market-making-unit' },
        ],
      },
    ],
  },
  {
    slug: 'pfof-orderflow',
    category: 'information',
    name: 'PFOF / order-flow sale',
    heading: 'Unfair PFOF / order flow',
    lead: 'Retail baseline = 0. Bar = USD millions per year the wholesaler books from internalizing this venue\'s retail flow.',
    unit: '$M / yr internalization',
    generalMarketLabel: 'Every order is public to every node. There is nothing left to sell.',
    rows: [
      {
        slug: 'robinhood-pfof',
        name: 'Robinhood',
        tag: 'PFOF + wholesaler rebates',
        value: 1400,
        gatedValue: 1400,
        lane: 'Retail: pays $1.4B in spread | MM: collects it via internalization (Citadel, Virtu, SIG)',
        barrier: 'Wholesaler internalization',
        sources: [
          { label: 'Robinhood · Q4 + full-year 2024 results', url: 'https://investors.robinhood.com/news-releases/news-release-details/robinhood-reports-fourth-quarter-and-full-year-2024-results' },
          { label: 'SEC press release 2020-321 · Robinhood $65M PFOF settlement', url: 'https://www.sec.gov/newsroom/press-releases/2020-321' },
          { label: 'Robinhood Financial · Q4 2024 Rule 606 report', url: 'https://www.sec.gov/Archives/edgar/data/0001783879/000178387925000035/a606_nmsx2024xq4xhood1.htm' },
        ],
      },
      {
        slug: 'etoro-apex-pfof',
        name: 'eToro',
        tag: 'Apex → Citadel routing',
        value: 250,
        gatedValue: 250,
        lane: 'Retail: pays spread + markup | MM: $0.25B/yr est. (Apex shares ~50% of what Citadel pays for eToro flow; HRT, Jane Street on routing list)',
        barrier: 'Apex routing agreement',
        sources: [
          { label: 'eToro USA · Rule 606 Q1 2024 disclosure', url: 'https://public.s3.com/rule606/etor/606-ETOR-2024Q1.pdf' },
          { label: 'eToro US Help · What is PFOF', url: 'https://help.etoro.com/en-us/s/article/What-is-Payment-for-Order-Flow-PFOF-US' },
        ],
      },
      {
        slug: 'coinbase-no-pfof',
        name: 'Coinbase',
        tag: 'Explicitly refuses',
        value: 0,
        gatedValue: 0,
        lane: 'Retail: pays full lit spread | MM: no PFOF surface to extract',
        barrier: 'Refuses',
        sources: [
          { label: 'Coinbase Help · pricing and fees disclosures', url: 'https://help.coinbase.com/en/coinbase/trading-and-funding/pricing-and-fees/fees' },
        ],
      },
      {
        slug: 'ibkr-pro-no-pfof',
        name: 'IBKR',
        tag: 'Pro tier refuses PFOF',
        value: 0,
        gatedValue: 0,
        lane: 'Retail (Pro): pays explicit commission | MM: 0 (Pro receives no PFOF, no inducement; Lite still routes through wholesalers)',
        barrier: 'Refuses (Pro tier)',
        sources: [
          { label: 'IBKR · Payment for Order Flow disclosure', url: 'https://www.interactivebrokers.com/en/trading/payment-for-order-flow.php' },
        ],
      },
    ],
  },

  // ─── LATENCY ────────────────────────────────────────────────────────────
  {
    slug: 'sip-vs-direct-feeds',
    category: 'latency',
    name: 'Premium vs public market data',
    heading: 'Unfair feed latency (SIP vs direct)',
    lead: 'Retail baseline = 0. Bar = milliseconds of feed latency advantage a maxed-tier MM has over the retail feed at this venue.',
    unit: 'ms latency edge',
    generalMarketLabel: 'Trades resolve once a minute. A faster feed buys nothing.',
    rows: [
      {
        slug: 'ibkr-passthrough-feeds',
        name: 'IBKR',
        tag: 'Snapshot vs depth',
        value: 1000,
        gatedValue: 1000,
        lane: 'Retail: free snapshot cadence (~seconds) | MM: NYSE American $24/mo + per-venue depth subscriptions',
        barrier: 'Subscription per venue + professional class',
        sources: [
          { label: 'IBKR · Market Data Pricing', url: 'https://www.interactivebrokers.com/en/pricing/market-data-pricing.php' },
        ],
      },
      {
        slug: 'hyperliquid-private-ws',
        name: 'Hyperliquid',
        tag: 'Private gateway',
        value: 500,
        gatedValue: 500,
        lane: 'Retail: 500ms diff push | MM: sub-ms private gateway + ~25ms gossip-priority head start',
        barrier: 'Private-gateway agreement + HYPE bids',
        sources: [
          { label: 'Dwellir · Hyperliquid Priority Fees', url: 'https://www.dwellir.com/blog/hyperliquid-priority-fees' },
        ],
      },
      {
        slug: 'pumpfun-shredstream',
        name: 'Pump.fun',
        tag: 'Jito ShredStream',
        value: 200,
        gatedValue: 200,
        lane: 'Retail: standard RPC | MM: ShredStream delivers pre-block shreds 50-200ms ahead',
        barrier: 'RPC tier subscription',
        sources: [
          { label: 'Helius · Solana RPC and ShredStream', url: 'https://www.helius.dev/solana-rpc-nodes' },
          { label: 'AllenHark · Solana RPC providers 2026', url: 'https://allenhark.com/solana-rpc-providers-comparison' },
        ],
      },
      {
        slug: 'kalshi-privatelink',
        name: 'Kalshi',
        tag: 'AWS PrivateLink FIX',
        value: 100,
        gatedValue: 100,
        lane: 'Retail: REST 50-200ms | MM: FIX 4.4 over AWS PrivateLink. Institutional traffic skips public internet',
        barrier: 'PrivateLink onboarding + FIX credentials',
        sources: [
          { label: 'Kalshi · FIX Connectivity (PrivateLink)', url: 'https://docs.kalshi.com/fix/connectivity' },
        ],
      },
      {
        slug: 'robinhood-sip-cost',
        name: 'Robinhood',
        tag: 'SIP vs direct feeds',
        value: 50,
        gatedValue: 50,
        lane: 'Retail: SIP-quoted | MM: direct exchange feeds. SEC found $34.1M customer harm (~$8.5M/yr)',
        barrier: 'Direct exchange feeds institution-only',
        sources: [
          { label: 'SEC Order 33-10906 · Robinhood Financial', url: 'https://www.sec.gov/files/litigation/admin/2020/33-10906.pdf' },
        ],
      },
      {
        slug: 'etoro-synthetic-feed',
        name: 'eToro',
        tag: 'Dealer-aggregated quote',
        value: 30,
        gatedValue: 30,
        lane: 'Retail: dealer-aggregated quote with markup | MM: raw tier-1 LP stream',
        barrier: 'Principal-CFD model',
        sources: [
          { label: 'eToro · Execution Policy and Order Routing Disclosures', url: 'https://www.etoro.com/wp-content/uploads/2021/09/eToro-Execution-Policy-and-Order-Routing-Disclosures.pdf' },
        ],
      },
      {
        slug: 'bybit-mmgw',
        name: 'Bybit',
        tag: 'MMGW 2.5ms',
        value: 28,
        gatedValue: 28,
        lane: 'Retail: 30ms WebSocket | MM: 2.5ms MMGW execution channel (2026)',
        barrier: 'Institutional MM credit programme',
        sources: [
          { label: 'PR Newswire · Bybit MMGW', url: 'https://www.prnewswire.com/news-releases/bybit-institutional-head-unveils-new-institutional-credit-architecture-and-ultra-low-latency-execution-layer-302636169.html' },
        ],
      },
      {
        slug: 'binance-fix-lp',
        name: 'Binance',
        tag: 'FIX API LP tier',
        value: 26,
        gatedValue: 26,
        lane: 'Retail: ~30ms WebSocket | MM: 4ms median FIX from AWS Tokyo',
        barrier: 'LP-program membership',
        sources: [
          { label: 'Binance Open Platform · FIX API documentation', url: 'https://developers.binance.com/docs/binance-spot-api-docs/fix-api' },
        ],
      },
      {
        slug: 'coinbase-ws-direct',
        name: 'Coinbase',
        tag: 'ws-direct + FIX',
        value: 20,
        gatedValue: 20,
        lane: 'Retail: ws-feed public | MM: ws-direct authenticated + colocated FIX',
        barrier: 'Auth + colo cross-connect',
        sources: [
          { label: 'Coinbase Exchange · WebSocket overview', url: 'https://docs.cdp.coinbase.com/exchange/websocket-feed/overview' },
        ],
      },
      {
        slug: 'deribit-ld4-multicast',
        name: 'Deribit',
        tag: 'LD4 UDP/SBE',
        value: 15,
        gatedValue: 15,
        lane: 'Retail: TCP repacked stream | MM: LD4 UDP/SBE multicast cage cross-connect',
        barrier: 'LD4 cage + cross-connect',
        sources: [
          { label: 'Deribit · Latency Optimisation', url: 'https://www.deribit.com/pages/information/Latency_optimisation' },
        ],
      },
      {
        slug: 'polymarket-no-sip',
        name: 'Polymarket',
        tag: 'WebSocket only',
        value: 10,
        gatedValue: 10,
        lane: 'Retail: WebSocket on far edge | MM: WebSocket near Cloudflare edge. Geography is the gap',
        barrier: 'Edge geography. No equal-access mandate',
        sources: [
          { label: 'Polymarket Docs · WebSocket Overview', url: 'https://docs.polymarket.com/market-data/websocket/overview' },
        ],
      },
    ],
  },

  // ─── EXECUTION ──────────────────────────────────────────────────────────
  {
    slug: 'matching-algo',
    category: 'execution',
    name: 'Matching-priority privileges',
    heading: 'Unfair matching engine priority',
    lead: 'The matching engine is whatever decides which order fills first. On a classical CLOB that means the FIFO book and whatever edit rights the venue grants: amend-keep, pro-rata, operator authority. On an AMM there is no book; the matching engine is the mempool, and whoever bundles or tips highest lands ahead of whoever does not. On an L1 with a public mempool, retail orders are visible before they confirm, and the venue\'s pending traffic is sequenced by validators, by Jito tip auctions, by gossip-priority auctions, by a single sequencer in the case of Base. Same privilege, different layer. Retail baseline = 0. Bar = bps priority a top-tier MM extracts. 0 = strict FIFO with no edit rights and no public mempool to read.',
    unit: 'bps priority edge',
    generalMarketLabel: 'Large losses are capped per order. A whale cannot pick off the small taker.',
    rows: [
      {
        slug: 'pumpfun-jito-priority',
        name: 'Pump.fun',
        tag: 'Jito MEV bundle priority',
        value: 8,
        gatedValue: 8,
        lane: 'Retail: 0 | MM: ~8 bps (no orderbook on an AMM, but Jito off-chain tip auction orders txs within a Solana slot. ~95% of stake honors. Whoever tips highest lands first)',
        barrier: 'Jito-Solana validator client + tip stack',
        sources: [
          { label: 'QuickNode · Jito Bundles guide', url: 'https://www.quicknode.com/guides/solana-development/transactions/jito-bundles' },
        ],
      },
      {
        slug: 'hyperliquid-gossip-mev',
        name: 'Hyperliquid',
        tag: 'HYPE gossip-priority auction',
        value: 4,
        gatedValue: 4,
        lane: 'Retail: 0 | MM: ~4 bps (HYPE-denominated Dutch auction sells gossip-priority slots ~25ms ahead of regular L1 traffic. MEV in the validator gossip layer, not the orderbook)',
        barrier: 'HYPE bid for priority slot',
        sources: [
          { label: 'Hyperliquid Docs · Priority Fees', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/priority-fees' },
        ],
      },
      {
        slug: 'polymarket-operator-fifo',
        name: 'Polymarket',
        tag: 'Operator + Polygon mempool',
        value: 5,
        gatedValue: 5,
        lane: 'Retail: 0 | MM: ~5 bps (matching off-chain by Polymarket-controlled operator set with exclusive matchOrders authority; settlement on Polygon\'s public mempool, which shipped a private-mempool RPC in April 2026 citing Polymarket front-running)',
        barrier: 'Operator role + public-mempool exposure',
        sources: [
          { label: 'Polymarket CTF Exchange · Overview.md', url: 'https://github.com/Polymarket/ctf-exchange/blob/main/docs/Overview.md' },
          { label: 'Polygon · Private Mempool launch', url: 'https://polygon.technology/blog/polygon-launches-private-mempool-mev-protection-is-now-a-one-line-integration' },
        ],
      },
      {
        slug: 'binance-amend-keep',
        name: 'Binance',
        tag: 'Order Amend Keep Priority',
        value: 3,
        gatedValue: 3,
        lane: 'Retail: 0 | MM: ~3 bps (shrink order without losing queue position. Rewards whoever modifies fastest)',
        barrier: 'API-level access',
        sources: [
          { label: 'Binance Developer · Order Amend Keep Priority', url: 'https://developers.binance.com/docs/binance-spot-api-docs/faqs/order_amend_keep_priority' },
        ],
      },
      {
        slug: 'deribit-fifo-shrink',
        name: 'Deribit',
        tag: 'Shrink-keeps-priority',
        value: 2,
        gatedValue: 2,
        lane: 'Retail: 0 | MM: ~2 bps (quantity reduction or same-price edit preserves the original timestamp)',
        barrier: 'API-level micro-edits',
        sources: [
          { label: 'Deribit Support · Order Management Best Practices', url: 'https://support.deribit.com/hc/en-us/articles/29514039279773-Order-Management-Best-Practices' },
        ],
      },
      {
        slug: 'coinbase-fifo',
        name: 'Coinbase',
        tag: 'FIFO book · single sequencer on Base',
        value: 1,
        gatedValue: 1,
        lane: 'Retail: 0 | MM: ~1 bps (Coinbase Exchange is strict FIFO at 500k orders/s; on Base, Coinbase runs the only sequencer, so every pending tx passes through Coinbase before it lands)',
        barrier: 'Sequencer operator role on Base',
        sources: [
          { label: 'Base docs · network information', url: 'https://docs.base.org/base-chain/network-information/base-network' },
        ],
      },
      {
        slug: 'kalshi-fifo',
        name: 'Kalshi',
        tag: 'Price-then-time',
        value: 0,
        gatedValue: 0,
        lane: 'Retail: 0 | MM: 0 (textbook FIFO. Price then time; identical prices fill in arrival order)',
        barrier: 'Strict FIFO',
        sources: [
          { label: 'Kalshi · API orders reference', url: 'https://docs.kalshi.com/api-reference/orders' },
        ],
      },
      {
        slug: 'bybit-implicit-fifo',
        name: 'Bybit',
        tag: 'Implicit FIFO',
        value: 0,
        gatedValue: 0,
        lane: 'Retail: 0 | MM: 0 (no public document names the matching algorithm; market orders convert to IOC limits)',
        barrier: 'Documentation absence',
        sources: [
          { label: 'Bybit · Order Types', url: 'https://www.bybit.com/en/help-center/article/Types-of-Orders-Available-on-Bybit' },
        ],
      },
    ],
  },
  {
    slug: 'cancel-to-trade',
    category: 'execution',
    name: 'Cancel-priority asymmetry',
    heading: 'Unfair cancellation priority',
    lead: 'Retail effective allowance ≈ 1. Bar = how many times more cancels per fill a top-tier MM is allowed than retail.',
    unit: '× retail cancel allowance',
    generalMarketLabel: 'Orders cannot be cancelled. The seal is the cancellation.',
    rows: [
      {
        slug: 'binance-cancel-bucket',
        name: 'Binance',
        tag: '15,000 cancels/min VIP',
        value: 249,
        gatedValue: 249,
        lane: 'Retail: ~1 cancel/fill | MM: 250 cancels/s ceiling (top VIP, 15,000/min)',
        barrier: 'VIP volume tier',
        sources: [
          { label: 'binance-spot-api-docs · REST API reference', url: 'https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md' },
        ],
      },
      {
        slug: 'bybit-batch-cancel',
        name: 'Bybit',
        tag: '200/s combined',
        value: 199,
        gatedValue: 199,
        lane: 'Retail: ~1 cancel/fill | MM: 200/s (separate batch-cancel budget, 100/s on each lane)',
        barrier: 'API-tier classification',
        sources: [
          { label: 'Bybit · v5 rate limits', url: 'https://bybit-exchange.github.io/docs/v5/rate-limit' },
          { label: 'Bybit · Cancel All Orders', url: 'https://bybit-exchange.github.io/docs/v5/order/cancel-all' },
        ],
      },
      {
        slug: 'hyperliquid-cancel-first',
        name: 'Hyperliquid',
        tag: 'Cancels-before-takers',
        value: 50,
        gatedValue: 50,
        lane: 'Retail: ~1 cancel/fill | MM: ~50 (cancels sequenced before any taker in-block; zero gas to place or cancel)',
        barrier: 'Protocol-level ordering rule',
        sources: [
          { label: 'Hyperliquid Docs · Priority Fees', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/priority-fees' },
        ],
      },
      {
        slug: 'polymarket-free-offchain-cancel',
        name: 'Polymarket',
        tag: 'Off-chain free cancel',
        value: 30,
        gatedValue: 30,
        lane: 'Retail: ~1 cancel/fill | MM: ~30 (CLOB cancels gas-free; post, observe queue, retract at zero cost)',
        barrier: 'CLOB API auth',
        sources: [
          { label: 'Polymarket Docs · Cancel Order', url: 'https://docs.polymarket.com/trading/orders/cancel' },
        ],
      },
      {
        slug: 'coinbase-smp-fix',
        name: 'Coinbase',
        tag: 'SMP FIX tag 7928',
        value: 20,
        gatedValue: 20,
        lane: 'Retail: ~1 cancel/fill | MM: ~20 (Self-Match Prevention across sub-accounts via FIX tag 7928)',
        barrier: 'FIX-tier connectivity',
        sources: [
          { label: 'Coinbase · FIX NewOrderSingle spec', url: 'https://docs.cdp.coinbase.com/exchange/docs/fix-msg-newordersingle' },
          { label: 'Coinbase Derivatives · Self-Match Prevention', url: 'https://help.coinbase.com/en/derivatives/risk-management/self-match-prevention' },
        ],
      },
      {
        slug: 'deribit-shrink-keep',
        name: 'Deribit',
        tag: 'Edit retains timestamp',
        value: 10,
        gatedValue: 10,
        lane: 'Retail: ~1 cancel/fill | MM: ~10 (shrink or same-price edit preserves timestamp; cancel-and-replace forfeits)',
        barrier: 'API credentials',
        sources: [
          { label: 'Deribit · Order Management Best Practices', url: 'https://support.deribit.com/hc/en-us/articles/29514039279773-Order-Management-Best-Practices' },
        ],
      },
      {
        slug: 'kalshi-smp-cancel',
        name: 'Kalshi',
        tag: 'SMP cancel endpoint',
        value: 5,
        gatedValue: 5,
        lane: 'Retail: ~1 cancel/fill | MM: ~5 (standard cancel + self_trade_prevention_type fields)',
        barrier: 'API-tier subscription',
        sources: [
          { label: 'Kalshi · Cancel Order API reference', url: 'https://docs.kalshi.com/api-reference/orders/cancel-order' },
        ],
      },
    ],
  },
  {
    slug: 'api-rate-ceiling',
    category: 'execution',
    name: 'API rate-limit tiers',
    heading: 'Unfair API rate limits',
    lead: 'Retail baseline = 1×. Bar = how many times faster the maxed-out MM tier can hit the API than the retail default.',
    unit: '× retail req/min',
    generalMarketLabel: 'One block per minute. There is nothing for the HFT loop to spin against.',
    rows: [
      {
        slug: 'binance-futures-vip',
        name: 'Binance',
        tag: 'VIP 250k msg/min',
        value: 104,
        gatedValue: 104,
        lane: 'Retail: 2,400 msg/min/IP | MM: 250,000 msg/min top VIP = 104× retail',
        barrier: 'VIP volume tier',
        sources: [
          { label: 'Binance Support · Rate Limits on Binance Futures', url: 'https://www.binance.com/en/support/faq/rate-limits-on-binance-futures-281596e222414cdd9051664ea621cdc3' },
        ],
      },
      {
        slug: 'polymarket-rate',
        name: 'Polymarket',
        tag: '5,000 req / 10s burst',
        value: 50,
        gatedValue: 50,
        lane: 'Retail: ~10 req/s baseline | MM: 500 req/s POST /order burst = 50× retail',
        barrier: 'Cloudflare rate limit',
        sources: [
          { label: 'Polymarket Docs · API Rate Limits', url: 'https://docs.polymarket.com/quickstart/introduction/rate-limits' },
        ],
      },
      {
        slug: 'pumpfun-rpc-tier',
        name: 'Pump.fun',
        tag: 'QuickNode Metis',
        value: 30,
        gatedValue: 30,
        lane: 'Retail: ~5 req/s free RPC | MM: ~150 req/s paid RPC tier = 30× retail',
        barrier: 'RPC subscription tier',
        sources: [
          { label: 'QuickNode Metis · Pump.fun quote endpoint', url: 'https://www.quicknode.com/docs/solana/pump-fun-quote' },
        ],
      },
      {
        slug: 'kalshi-prime',
        name: 'Kalshi',
        tag: 'Prime 4,000 tokens/s',
        value: 20,
        gatedValue: 20,
        lane: 'Retail: ~20 reads/s Basic | MM: 400 reads/s Prime = 20× retail',
        barrier: 'Prime-tier classification',
        sources: [
          { label: 'Kalshi · Rate Limits & Tiers', url: 'https://docs.kalshi.com/getting_started/rate_limits' },
        ],
      },
      {
        slug: 'hyperliquid-rate',
        name: 'Hyperliquid',
        tag: 'Lifetime-volume throttle',
        value: 20,
        gatedValue: 20,
        lane: 'Retail: ~1 req/s sustained | MM: ~20 req/s scaled by lifetime venue volume',
        barrier: 'Lifetime venue volume',
        sources: [
          { label: 'Hyperliquid Docs · Rate Limits', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits' },
        ],
      },
      {
        slug: 'deribit-rate',
        name: 'Deribit',
        tag: 'Matching credit bucket',
        value: 10,
        gatedValue: 10,
        lane: 'Retail: ~2 req/s baseline | MM: ~20 req/s top sub-account volume = 10× retail',
        barrier: 'Sub-account volume class',
        sources: [
          { label: 'Deribit Support · Rate Limits', url: 'https://support.deribit.com/hc/en-us/articles/25944617523357-Rate-Limits' },
        ],
      },
      {
        slug: 'bybit-institutional-rate',
        name: 'Bybit',
        tag: 'Per-UID negotiated',
        value: 3.3,
        gatedValue: 3.3,
        lane: 'Retail: 120 req/s per IP | MM: 400 req/s by bilateral agreement = 3.3× retail',
        barrier: 'Bilateral institutional contract',
        sources: [
          { label: 'Bybit · V5 Rate Limit Rules', url: 'https://bybit-exchange.github.io/docs/v5/rate-limit' },
        ],
      },
      {
        slug: 'coinbase-advanced-rate',
        name: 'Coinbase',
        tag: 'Prime tier private',
        value: 3,
        gatedValue: 3,
        lane: 'Retail: 10 req/s public REST | MM: 30 req/s private + higher Prime allowances = 3× retail',
        barrier: 'Prime onboarding',
        sources: [
          { label: 'Coinbase · Advanced Trade REST rate limits', url: 'https://docs.cdp.coinbase.com/advanced-trade/docs/rest-api-rate-limits' },
        ],
      },
      {
        slug: 'ibkr-tws-cap',
        name: 'IBKR',
        tag: '50 msg/s TWS',
        value: 1,
        gatedValue: 1,
        lane: 'Retail: 50 msg/s | MM: 50 msg/s. Uniform TWS ceiling = 1× retail',
        barrier: 'TWS architecture',
        sources: [
          { label: 'IBKR TWS API · Historical Data Limitations', url: 'https://interactivebrokers.github.io/tws-api/historical_limitations.html' },
        ],
      },
      {
        slug: 'etoro-api-rate',
        name: 'eToro',
        tag: '60 reads/min select',
        value: 1,
        gatedValue: 1,
        lane: 'Retail: 60 reads/min | MM: 60 reads/min. Single uniform tier = 1× retail',
        barrier: 'Select-user rollout (Oct 2025)',
        sources: [
          { label: 'eToro API Portal · Rate Limits', url: 'https://api-portal.etoro.com/getting-started/rate-limits' },
        ],
      },
    ],
  },
  {
    slug: 'funding-cap',
    category: 'execution',
    name: 'Funding-rate boundary cycle',
    heading: 'Unfair funding-rate boundary',
    lead: 'Retail baseline = 0 (takes the funding payment as priced). Bar = annualized bps an MM extracts by fading the funding-rate boundary at this venue. Only perp venues apply.',
    unit: 'bps/yr boundary-arb edge',
    generalMarketLabel: 'No perpetuals. No funding clock to bracket.',
    rows: [
      {
        slug: 'hyperliquid-cap',
        name: 'Hyperliquid',
        tag: '4%/h cap, hourly',
        value: 8760,
        gatedValue: 8760,
        lane: 'Retail: 0 | MM: ~8,760 bps/yr (hourly payments capped at 4%/h; sub-second flip fades the boundary)',
        barrier: 'Sub-second flip',
        sources: [
          { label: 'Hyperliquid Docs · Funding', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding' },
        ],
      },
      {
        slug: 'deribit-usdc-linear-cap',
        name: 'Deribit',
        tag: '±5%/8h USDC linear',
        value: 5475,
        gatedValue: 5475,
        lane: 'Retail: 0 | MM: ~5,475 bps/yr (±5%/8h USDC linear cap with ±0.025% dead-zone. Sub-second flip fade)',
        barrier: 'Cap formula',
        sources: [
          { label: 'Deribit Insights · Perpetual Swap Funding', url: 'https://insights.deribit.com/education/perpetual-swap-funding/' },
        ],
      },
      {
        slug: 'binance-perp-cap',
        name: 'Binance',
        tag: '±0.75%/8h USDS-M',
        value: 820,
        gatedValue: 820,
        lane: 'Retail: 0 | MM: ~820 bps/yr (±0.75%/8h time-weighted, last hour dominates; ±0.3%/4h shortened-interval)',
        barrier: 'Cap-tier classification',
        sources: [
          { label: 'Binance Support · Introduction to Futures Funding Rates', url: 'https://www.binance.com/en/support/faq/360033525031' },
        ],
      },
      {
        slug: 'coinbase-international-cap',
        name: 'Coinbase International',
        tag: '1h, no clamp',
        value: 600,
        gatedValue: 600,
        lane: 'Retail: 0 | MM: ~600 bps/yr (hourly TWAP, no base interest, no clamp. Rate moves freely with the premium index)',
        barrier: 'No cap',
        sources: [
          { label: 'Coinbase International · Funding rate mechanics', url: 'https://help.coinbase.com/en/international-exchange/funding/what-is-the-funding-rate' },
        ],
      },
      {
        slug: 'bybit-perp-cap',
        name: 'Bybit',
        tag: 'Dynamic 1/4/8h',
        value: 200,
        gatedValue: 200,
        lane: 'Retail: 0 | MM: ~200 bps/yr (cap dynamic: min((IMR−MMR)×0.75, MMR); dynamic settlement flips 8h→4h→1h)',
        barrier: 'Cap formula keys on IMR/MMR',
        sources: [
          { label: 'Bybit · Funding Fee Calculation', url: 'https://www.bybit.com/en/help-center/article/Funding-fee-calculation' },
        ],
      },
    ],
  },

  // ─── SUBSIDY ────────────────────────────────────────────────────────────
  {
    slug: 'mm-subsidy',
    category: 'subsidy',
    name: 'Market-maker subsidy programs',
    heading: 'MM programs paying makers to quote',
    lead: 'Retail baseline = $0 subsidy. Bar = USD millions per year of explicit cash subsidy the venue (or retail flow) pays to named market makers.',
    unit: '$M / yr cash subsidy',
    generalMarketLabel: 'Makers are paid for showing up, not for size. The whale rebate never existed.',
    rows: [
      {
        slug: 'kalshi-sportsbook-hedge',
        name: 'Kalshi',
        tag: 'Sportsbook 100% rebate',
        value: 60,
        gatedValue: 60,
        lane: 'Retail: 0 | MM: ~$60M/yr (100% taker + RFQ fee rebate once member buys ≥300k contracts/order/month for hedging)',
        barrier: 'CFTC filing + sportsbook entity',
        sources: [
          { label: 'CFTC filing · Sportsbook Hedging Rebate Program', url: 'https://www.cftc.gov/sites/default/files/filings/orgrules/26/02/rules02072638946.pdf' },
        ],
      },
      {
        slug: 'coinbase-tier-8',
        name: 'Coinbase',
        tag: 'Tier 8 0% maker',
        value: 50,
        gatedValue: 50,
        lane: 'Retail: 0 | MM: ~$50M/yr (Tier 8 0% maker + 15× thin-pair multipliers. Wintermute, Cumberland, Jump in top three)',
        barrier: '$250M 30-day volume + program acceptance',
        sources: [
          { label: 'Coinbase Exchange · Liquidity Program', url: 'https://www.coinbase.com/exchange/liquidity-program' },
        ],
      },
      {
        slug: 'binance-lp-rebate',
        name: 'Binance',
        tag: 'Spot + USDS-M LP',
        value: 40,
        gatedValue: 40,
        lane: 'Retail: 0 | MM: ~$40M/yr (Spot/USDS-M/Coin-M LP rebates up to −0.01% spot + elevated API + low-latency endpoints)',
        barrier: 'LP-program application',
        sources: [
          { label: 'Binance Blog · Spot Liquidity Provider Program', url: 'https://www.binance.com/en/blog/markets/introducing-the-new-and-improved-spot-liquidity-provider-program-421499824684903432' },
        ],
      },
      {
        slug: 'hyperliquid-hlp-subsidy',
        name: 'Hyperliquid',
        tag: 'HLP + Tier 6 rebate',
        value: 30,
        gatedValue: 30,
        lane: 'Retail: 0 | MM: ~$30M/yr (HLP concentrates community capital with socialized PnL; Tier 6 pays −0.003% to >3% maker-share)',
        barrier: '3% market share in 14 days',
        sources: [
          { label: 'Hyperliquid Docs · Fees', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees' },
        ],
      },
      {
        slug: 'deribit-vip6',
        name: 'Deribit',
        tag: 'VIP 6 options 66.66%',
        value: 20,
        gatedValue: 20,
        lane: 'Retail: 0 | MM: ~$20M/yr (VIP 6. 66.66% options + 55% futures fee discount at ≥$5B 30-day volume)',
        barrier: '$5B 30-day volume',
        sources: [
          { label: 'Phemex News · Deribit VIP fee system', url: 'https://phemex.com/news/article/deribit-to-launch-automated-vip-fee-system-solana-targets-260-27184' },
        ],
      },
      {
        slug: 'bybit-mm-incentive',
        name: 'Bybit',
        tag: '−0.01% rebate',
        value: 15,
        gatedValue: 15,
        lane: 'Retail: 0 | MM: ~$15M/yr (MM Incentive maker rebates up to −0.01%; apply via institutional_services@bybit.com)',
        barrier: 'Institutional-services contract',
        sources: [
          { label: 'Bybit · MM Incentive Program', url: 'https://www.bybit.com/en/help-center/article/Introduction-to-the-Market-Maker-Incentive-Program' },
        ],
      },
      {
        slug: 'etoro-popular-investor',
        name: 'eToro',
        tag: '2-2.5% of AUC',
        value: 10,
        gatedValue: 10,
        lane: 'Retail: 0 | MM: ~$10M/yr (Champions $400/mo; Elites 1.5-2% of avg AUC; Elite Pro 2-2.5%; >$100M AUC drops to 0.25%)',
        barrier: 'Popular Investor classification',
        sources: [
          { label: 'eToro · Popular Investor program tiers', url: 'https://www.etoro.com/copytrader/popular-investor/' },
          { label: 'eToro Help · how Popular Investors are paid', url: 'https://help.etoro.com/s/article/how-are-popular-investors-paid?language=en_GB' },
        ],
      },
      {
        slug: 'polymarket-noncrypto',
        name: 'Polymarket',
        tag: '25% taker rebate',
        value: 3,
        gatedValue: 3,
        lane: 'Retail: 0 | MM: ~$3M/yr (Maker Rebates Program returns 25% taker fee non-crypto / 20% Crypto; Geopolitics zero)',
        barrier: 'Pool dominance',
        sources: [
          { label: 'Polymarket Docs · Maker Rebates Program', url: 'https://docs.polymarket.com/market-makers/maker-rebates' },
        ],
      },
    ],
  },
  {
    slug: 'maker-rebate-tier',
    category: 'subsidy',
    name: 'Maker rebate at top tier',
    heading: 'Unfair maker rebate tiers',
    lead: 'Retail baseline = 0 bps (often pays the maker fee). Bar = bps/side of maker rebate the top-tier MM receives at this venue.',
    unit: 'bps/side maker rebate',
    generalMarketLabel: 'One fee. No tier table.',
    rows: [
      {
        slug: 'coinbase-advanced-top',
        name: 'Coinbase',
        tag: 'Top Advanced 0 vs 40 bps',
        value: 4,
        gatedValue: 4,
        lane: 'Retail: 40 bps maker | MM: 0 bps published top tier; LP Program rebate ~−1 to −3 bps undisclosed-discretionary',
        barrier: '>$400M 30-day volume + LP Program invite',
        sources: [
          { label: 'Coinbase · Advanced fees', url: 'https://www.coinbase.com/advanced-fees' },
          { label: 'Coinbase Exchange · Liquidity Program', url: 'https://www.coinbase.com/exchange/liquidity-program' },
        ],
      },
      {
        slug: 'kalshi-lip',
        name: 'Kalshi',
        tag: 'DMM terms undisclosed',
        value: 0,
        gatedValue: 0,
        lane: 'Retail: pays formula taker fee | DMM: "reduced fees, differing position limits, enhanced access" (Rulebook v1.18 Ch. 4; undisclosed range)',
        barrier: 'Executed Market Maker Agreement + Kalshi review',
        sources: [
          { label: 'Kalshi · fee schedule', url: 'https://kalshi.com/regulatory/fee-schedule' },
          { label: 'Pelayo v. Kalshi · SDNY 1:25-cv-09913', url: 'https://www.bloomberg.com/news/articles/2025-11-28/kalshi-market-maker-bets-against-consumers-lawsuit-alleges' },
        ],
      },
      {
        slug: 'hyperliquid-tier-6',
        name: 'Hyperliquid',
        tag: 'Tier 3 rebate −3 bps',
        value: 3,
        gatedValue: 3,
        lane: 'Retail: 1.5 bps maker | MM: −3 bps rebate at Maker Rebate Tier 3',
        barrier: '>3% of 14-day exchange-wide maker share',
        sources: [
          { label: 'Hyperliquid Docs · fees', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees' },
        ],
      },
      {
        slug: 'deribit-vip6-options',
        name: 'Deribit',
        tag: 'VIP 6 options 1 vs 3 bps',
        value: 1,
        gatedValue: 1,
        lane: 'Retail: 3 bps options maker | MM: 1 bps net cost at VIP 6 (66.66% discount, not a rebate)',
        barrier: '$5B 30-day options notional',
        sources: [
          { label: 'Deribit · fees', url: 'https://www.deribit.com/kb/fees' },
        ],
      },
      {
        slug: 'bybit-mm-incentive-rebate',
        name: 'Bybit',
        tag: 'MMIP MM3 −0.4 bps',
        value: 0.4,
        gatedValue: 0.4,
        lane: 'Retail: 2 bps perps maker | MM: −0.4 bps/side MMIP MM3 rebate (Group 1 perps)',
        barrier: '≥1.00% weighted maker share, institutional-services contract',
        sources: [
          { label: 'Bybit · trading fees', url: 'https://www.bybit.com/en/help-center/article/Trading-Fee-Structure' },
          { label: 'Bybit · MMIP rebate adjustment', url: 'https://announcements.bybit.com/en/article/adjustments-to-maker-rebates-for-market-makers-on-major-perpetual-contracts-blt0bd73e2d7150b224/' },
        ],
      },
      {
        slug: 'binance-futures-vip9-lp',
        name: 'Binance',
        tag: 'VIP 9 + MM −0.5 bps',
        value: 1,
        gatedValue: 1,
        lane: 'Retail: 2 bps maker | MM: 0 bps VIP 9 base + −0.5 bps/side Futures MM Program rebate',
        barrier: 'VIP 9 (≥$30B/30d + 5,500 BNB) + MM Program application',
        sources: [
          { label: 'Binance · Futures MM Program', url: 'https://www.binance.com/en/support/faq/binance-futures-market-maker-program-b65fefd0fee84893ad946dc6f707dedc' },
        ],
      },
      {
        slug: 'polymarket-rebate-tier',
        name: 'Polymarket',
        tag: 'Pool-based, not per-fill',
        value: 0,
        gatedValue: 0,
        lane: 'Retail: pays taker fee | MM: 20–25% of pooled taker fees redistributed pro-rata. Not a per-fill rebate',
        barrier: 'Pool dominance. Share of total maker fee-equivalent volume',
        sources: [
          { label: 'Polymarket Docs · trading fees', url: 'https://docs.polymarket.com/trading/fees' },
          { label: 'Polymarket Help · trading fees', url: 'https://help.polymarket.com/en/articles/13364478-trading-fees' },
        ],
      },
    ],
  },
  // ─── RISK ───────────────────────────────────────────────────────────────
  {
    slug: 'liquidation-cascade-day',
    category: 'risk',
    name: 'Liquidation engine quirks',
    heading: 'Unfair liquidation engine quirks',
    lead: 'Retail baseline = 0 (takes the loss). Bar = USD billions notional liquidated in the named cascade day at this venue. Only leveraged venues apply.',
    unit: '$B liquidated in named cascade',
    generalMarketLabel: 'Leverage runs entirely through parimutuel. The auto-liquidator never existed.',
    rows: [
      {
        slug: 'bybit-lazarus-feb-2025',
        name: 'Bybit',
        tag: 'Feb 21 2025 drain',
        value: 9.55,
        gatedValue: 9.55,
        lane: 'Retail: 0 | MM: $9.55B (Lazarus 401k ETH drained from cold wallet; perp IF stress; ADL ranks by PnL% × leverage)',
        barrier: 'Loss-absorption pool',
        sources: [
          { label: 'Bybit · Auto-Deleveraging (ADL)', url: 'https://www.bybit.com/en/help-center/article/Auto-Deleveraging-ADL' },
        ],
      },
      {
        slug: 'binance-may-19-2021',
        name: 'Binance',
        tag: 'May 19 2021 freeze',
        value: 1.5,
        gatedValue: 1.5,
        lane: 'Retail: 0 | MM: $1.5B (platform froze at 13:30 UTC, reopened with prices recovered; shorts argued the outage saved ~$1B in IF losses)',
        barrier: 'Mark Price + Insurance Fund + ADL',
        sources: [
          { label: 'New Money Review · May 19 liquidations', url: 'https://newmoneyreview.com/index.php/2021/08/04/did-binance-cover-up-may-19-liquidations/' },
        ],
      },
      {
        slug: 'robinhood-gme-halt',
        name: 'Robinhood',
        tag: 'GME buy-button halt',
        value: 1.4,
        gatedValue: 1.4,
        lane: 'Retail: 0 | MM: $1.4B NSCC deposit (up from $125M). Firm barred GME long positions while permitting only sells',
        barrier: 'Margin agreement discretion + NSCC capital call',
        sources: [
          { label: 'Robinhood Margin Disclosure Statement', url: 'https://cdn.robinhood.com/assets/robinhood/legal/RHF%20and%20RHS%20Margin%20Disclosure%20Statement.pdf' },
        ],
      },
      {
        slug: 'ibkr-neg-oil-2020',
        name: 'IBKR',
        tag: 'Negative oil 2020-04-20',
        value: 0.104,
        gatedValue: 0.104,
        lane: 'Retail: 0 | MM: $104M (WTI settled at −$37.63; platform failed to accept negative-price limit orders; CFTC ordered $1.75M penalty + $82.57M restitution)',
        barrier: 'Liquidator missing negative-price branch',
        sources: [
          { label: 'CFTC · Order against IBKR LLC (negative oil)', url: 'https://www.cftc.gov/PressRoom/PressReleases/8432-21' },
        ],
      },
      {
        slug: 'hyperliquid-jelly-mar-2025',
        name: 'Hyperliquid',
        tag: 'JELLY validator vote',
        value: 0.0135,
        gatedValue: 0.0135,
        lane: 'Retail: 0 | MM: $13.5M (validators voted JELLY closed at $0.0095, bypassing book and oracle; Foundation made non-flagged users whole)',
        barrier: 'Validator-set vote. Manual engine override',
        sources: [
          { label: 'CoinDesk · Hyperliquid delists JELLY', url: 'https://www.coindesk.com/markets/2025/03/26/hyperliquid-delists-jellyjelly-after-vault-squeezed-in-usd13m-tussle' },
        ],
      },
      {
        slug: 'deribit-march-12-2020',
        name: 'Deribit',
        tag: 'March 12 2020 top-up',
        value: 0.013,
        gatedValue: 0.013,
        lane: 'Retail: 0 | MM: $13M (IF lost 1,627 BTC; Deribit injected 500 BTC company funds to prevent socialised loss)',
        barrier: 'Company-treasury discretion',
        sources: [
          { label: 'Bitcoinist · Deribit tops up rekt insurance fund', url: 'https://bitcoinist.com/deribit-tops-up-rekt-insurance-fund/' },
        ],
      },
      {
        slug: 'coinbase-international-fund',
        name: 'Coinbase International',
        tag: '1% liquidation fee',
        value: 0.001,
        gatedValue: 0.001,
        lane: 'Retail: 0 | MM: $1M (1.0% liquidation fee flows to USDC IF + Liquidity Support Program; no socialized-loss waterfall public)',
        barrier: 'Bermuda BMA-licensed entity',
        sources: [
          { label: 'Coinbase International · Exchange fees', url: 'https://help.coinbase.com/en/international-exchange/trading-deposits-withdrawals/international-exchange-fees' },
        ],
      },
      {
        slug: 'etoro-esma-stopout',
        name: 'eToro',
        tag: 'ESMA 50% auto-close',
        value: 0.0005,
        gatedValue: 0.0005,
        lane: 'Retail: 0 | MM: $0.5M (ESMA 2018. Retail CFDs auto-close at 50% min margin with negative-balance protection; EU/UK clients only)',
        barrier: 'EU/UK onboarding',
        sources: [
          { label: 'ESMA · Final product intervention measures', url: 'https://www.esma.europa.eu/press-news/esma-news/esma-adopts-final-product-intervention-measures-cfds-and-binary-options' },
          { label: 'eToro Help · Negative Balance Protection', url: 'https://help.etoro.com/s/article/what-is-negative-balance-protection?language=en_GB' },
        ],
      },
    ],
  },
]
