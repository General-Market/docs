import { Reveal } from '@/components/ui/Reveal'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'

interface ColoVenue {
  slug: string
  name: string
  region: string
  proof: string
  attribution: string
  sourceLabel: string
  sourceUrl: string
  insiderMs: number
  outsiderMs: number
  outsiderOrigin: string
  quote?: boolean
}

const COLO_VENUES: ColoVenue[] = [
  {
    slug: 'polymarket-colo',
    name: 'Polymarket',
    region: 'AWS eu-west-2 — London',
    proof: 'Direct co-location available. Users who complete the KYC/KYB form can get access to co-locate directly in eu-west-2.',
    attribution: 'Polymarket trading documentation',
    sourceLabel: 'docs.polymarket.com',
    sourceUrl: 'https://docs.polymarket.com/trading/overview',
    insiderMs: 2,
    outsiderMs: 80,
    outsiderOrigin: 'New York retail',
    quote: true,
  },
  {
    slug: 'hyperliquid-colo',
    name: 'Hyperliquid',
    region: 'AWS ap-northeast-1 — Tokyo',
    proof: 'All 24 validators clustered in AWS Tokyo. Glassnode measured the asymmetry — local desks reach the matching engine ~200ms ahead of every other geography.',
    attribution: 'Glassnode measurement, March 2026',
    sourceLabel: 'Coindesk · Glassnode',
    sourceUrl: 'https://www.coindesk.com/markets/2026/03/30/hyperliquid-traders-in-tokyo-get-200-millisecond-edge-glassnode-research-shows',
    insiderMs: 3,
    outsiderMs: 200,
    outsiderOrigin: 'European desk',
  },
  {
    slug: 'kalshi-colo',
    name: 'Kalshi',
    region: 'Chicago — designated MM',
    proof: 'Susquehanna onboarded April 2024 as the first dedicated institutional market maker. The November 2025 class action names the privilege directly: unique contractual and technological integration.',
    attribution: 'Federal complaint, six states',
    sourceLabel: 'Bloomberg',
    sourceUrl: 'https://www.bloomberg.com/news/articles/2025-11-28/kalshi-market-maker-bets-against-consumers-lawsuit-alleges',
    insiderMs: 1,
    outsiderMs: 50,
    outsiderOrigin: 'Retail browser',
  },
]

interface LatencyRow {
  slug: string
  name: string
  edgeMs: number
  lane: string         // Retail: X | MM: Y form
  barrier: string      // single mechanism noun phrase
  source?: { label: string; url: string }
  barrierSource?: { label: string; url: string }
}

const LATENCY_ROWS: LatencyRow[] = [
  {
    slug: 'hyperliquid', name: 'Hyperliquid', edgeMs: 197,
    lane: 'Retail (European desk): +197ms | MM (Tokyo desk): ~3ms to validator cluster',
    barrier: 'AWS Tokyo proximity + Foundation node',
    source: { label: 'Coindesk · Glassnode', url: 'https://www.coindesk.com/markets/2026/03/30/hyperliquid-traders-in-tokyo-get-200-millisecond-edge-glassnode-research-shows' },
    barrierSource: { label: 'Hyperliquid docs', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/nodes/foundation-non-validating-node' },
  },
  {
    slug: 'binance', name: 'Binance', edgeMs: 145,
    lane: 'Retail (global): +145ms | MM (VIP 9): AWS Tokyo colo, ~5ms FIX',
    barrier: 'VIP 9 — $30B/30d futures + 5,500 BNB',
    source: { label: 'NYC Servers · Tokyo VPS', url: 'https://newyorkcityservers.com/binance-vps' },
    barrierSource: { label: 'Binance · VIP program', url: 'https://www.binance.com/en/vip-institutional-services' },
  },
  {
    slug: 'bybit', name: 'Bybit', edgeMs: 140,
    lane: 'Retail (global): +140ms | MM (institutional): AWS SG/Tokyo colo + 2.5ms MMGW',
    barrier: 'Institutional Services agreement',
    source: { label: 'Bybit · institutional', url: 'https://www.bybit.com/en/help-center/article/Bybit-Institutional-Services' },
    barrierSource: { label: 'Bybit · institutional', url: 'https://www.bybit.com/en/help-center/article/Bybit-Institutional-Services' },
  },
  {
    slug: 'pumpfun', name: 'Pump.fun', edgeMs: 130,
    lane: 'Retail (default RPC): +130ms | MM (sniper): validator-adjacent RPC + Jito bundles',
    barrier: 'Paid validator-adjacent RPC + Jito tips',
    source: { label: 'Helius · Solana latency', url: 'https://www.helius.dev/blog/solana-rpc-latency' },
    barrierSource: { label: 'Jito Labs · block engine', url: 'https://www.jito.wtf/' },
  },
  {
    slug: 'etoro', name: 'eToro', edgeMs: 100,
    lane: 'Retail: order never reaches a public market | MM (eToro itself): is the book',
    barrier: 'B-book CFD counterparty',
    source: { label: 'ASIC v eToro', url: 'https://asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-209mr-asic-sues-etoro-for-design-and-distribution-failings-and-misleading-conduct-relating-to-its-cfd-product/' },
    barrierSource: { label: 'ASIC v eToro', url: 'https://asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-209mr-asic-sues-etoro-for-design-and-distribution-failings-and-misleading-conduct-relating-to-its-cfd-product/' },
  },
  {
    slug: 'polymarket', name: 'Polymarket', edgeMs: 78,
    lane: 'Retail (NY): +78ms | MM (KYC\'d London colo): ~3ms in eu-west-2',
    barrier: 'KYC/KYB approval + eu-west-2 colocation',
    source: { label: 'docs.polymarket.com', url: 'https://docs.polymarket.com/trading/overview' },
    barrierSource: { label: 'docs.polymarket.com', url: 'https://docs.polymarket.com/trading/overview' },
  },
  {
    slug: 'deribit', name: 'Deribit', edgeMs: 75,
    lane: 'Retail (US): +75ms | MM (LD4 colo): ~2ms FIX cage cross-connect',
    barrier: 'Pro institutional FIX gateway + MM agreement',
    source: { label: 'Deribit · institutional', url: 'https://www.deribit.com/kb/api-overview' },
    barrierSource: { label: 'Deribit · FIX', url: 'https://docs.deribit.com/?javascript#fix-api' },
  },
  {
    slug: 'coinbase', name: 'Coinbase', edgeMs: 60,
    lane: 'Retail (Asia/EU): +60ms | MM (Prime): us-east-1 / Equinix LD4 FIX',
    barrier: 'Coinbase Prime onboarding + institutional FIX',
    source: { label: 'Coinbase · Prime', url: 'https://prime.coinbase.com/' },
    barrierSource: { label: 'Coinbase · Prime FIX', url: 'https://docs.cdp.coinbase.com/prime/docs/fix-api-overview' },
  },
  {
    slug: 'ibkr', name: 'IBKR', edgeMs: 50,
    lane: 'Retail (SmartRouter): +50ms | MM (Pro DMA): direct market access',
    barrier: 'Pro/institutional capital + commercial agreement',
    source: { label: 'IBKR · DMA', url: 'https://www.interactivebrokers.com/en/trading/orders/smartRouting.php' },
    barrierSource: { label: 'IBKR · Pro DMA', url: 'https://www.interactivebrokers.com/en/general/finlearn/order-types-routing/ibkr-pro-direct-market-access.php' },
  },
  {
    slug: 'kalshi', name: 'Kalshi', edgeMs: 49,
    lane: 'Retail (browser): +49ms | MM (Chicago designated): ~1ms cross-connect',
    barrier: 'Designated MM contract',
    source: { label: 'Bloomberg · class action', url: 'https://www.bloomberg.com/news/articles/2025-11-28/kalshi-market-maker-bets-against-consumers-lawsuit-alleges' },
    barrierSource: { label: 'Kalshi · MM program', url: 'https://help.kalshi.com/en/articles/13823819-market-maker-program' },
  },
  {
    slug: 'robinhood', name: 'Robinhood', edgeMs: 35,
    lane: 'Retail: lit-market execution | MM (Citadel): PFOF info window before book',
    barrier: 'Wholesaler internalization',
    source: { label: 'SEC · Robinhood PFOF', url: 'https://www.sec.gov/newsroom/press-releases/2020-321' },
    barrierSource: { label: 'SEC · Robinhood PFOF', url: 'https://www.sec.gov/newsroom/press-releases/2020-321' },
  },
]

const MAX_EDGE = Math.max(...LATENCY_ROWS.map(r => r.edgeMs))

function ColoCard({ v, delay }: { v: ColoVenue; delay: number }) {
  const gap = v.outsiderMs - v.insiderMs
  return (
    <Reveal delay={delay}>
      <article
        className="flex flex-col h-full"
        style={{
          background: 'var(--apple-panel)',
          border: `1px solid ${LINE}`,
          borderRadius: 'var(--apple-r-md)',
          padding: 22,
          gap: 12,
          aspectRatio: '1 / 1',
          minHeight: 360,
        }}
      >
        <header className="flex items-baseline justify-between gap-3">
          <h3
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 21,
              fontWeight: 600,
              letterSpacing: '-0.022em',
              color: TEXT,
            }}
          >
            {v.name}
          </h3>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: '-0.016em',
              color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            +{gap}ms
          </span>
        </header>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: TERTIARY,
            letterSpacing: '-0.005em',
          }}
        >
          {v.region}
        </div>

        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            lineHeight: 1.45,
            letterSpacing: '-0.011em',
            color: TEXT,
            fontWeight: 500,
            fontStyle: v.quote ? 'italic' : 'normal',
          }}
        >
          {v.quote ? `"${v.proof}"` : v.proof}
        </p>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: SECONDARY,
            letterSpacing: '-0.005em',
          }}
        >
          — {v.attribution}
        </div>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginTop: 'auto',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Inside lane {v.insiderMs}ms · {v.outsiderOrigin} {v.outsiderMs}ms
        </div>

        <footer
          className="flex items-center justify-between gap-3 pt-3"
          style={{ borderTop: `1px solid ${LINE}` }}
        >
          <a
            href={v.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              fontWeight: 500,
              color: ACCENT,
              letterSpacing: '-0.005em',
            }}
            className="hover:underline"
          >
            {v.sourceLabel} ›
          </a>
        </footer>
      </article>
    </Reveal>
  )
}

function LatencyBarRow({ row }: { row: LatencyRow }) {
  const pct = Math.max((row.edgeMs / MAX_EDGE) * 100, row.edgeMs > 0 ? 2 : 0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          flex: '0 0 120px',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          color: TEXT,
          letterSpacing: '-0.011em',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.name}
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: 'var(--apple-surface)',
          borderRadius: 4,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -3,
            bottom: -3,
            width: 0,
            borderLeft: `1px dashed color-mix(in srgb, ${TERTIARY} 50%, transparent)`,
          }}
          aria-hidden
        />
        {pct > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${pct}%`,
              background: ACCENT,
              borderRadius: 4,
            }}
          />
        )}
      </div>
      <div
        style={{
          flex: '0 0 100px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          fontSize: 14,
          fontWeight: 600,
          color: ACCENT,
          whiteSpace: 'nowrap',
        }}
      >
        +{row.edgeMs}ms
      </div>
    </div>
  )
}

function GeneralMarketRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          flex: '0 0 120px',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          color: TEXT,
          letterSpacing: '-0.011em',
          fontWeight: 600,
        }}
      >
        General Market
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: 'var(--apple-surface)',
          borderRadius: 4,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -3,
            bottom: -3,
            width: 0,
            borderLeft: `1px dashed color-mix(in srgb, ${TERTIARY} 50%, transparent)`,
          }}
          aria-hidden
        />
      </div>
      <div
        style={{
          flex: '0 0 100px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          fontSize: 14,
          fontWeight: 600,
          color: TERTIARY,
          whiteSpace: 'nowrap',
        }}
      >
        0
      </div>
    </div>
  )
}

export function ColocationSection() {
  return (
    <section
      id="colocation-edge"
      style={{
        paddingTop: 80,
        paddingBottom: 24,
        borderTop: `1px solid ${LINE}`,
        scrollMarginTop: 80,
      }}
    >
      <Reveal>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginBottom: 10,
          }}
        >
          The receipts that aren't even illegal · {LATENCY_ROWS.length} venues · no published prices
        </div>
      </Reveal>
      <Reveal mask delay={0.04}>
        <h2
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(28px, 3.6vw, 40px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
            lineHeight: 1.1,
            color: TEXT,
            maxWidth: 820,
          }}
        >
          Unfair colocation
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 17,
            lineHeight: 1.47,
            letterSpacing: 'var(--apple-track-tight)',
            color: SECONDARY,
            marginTop: 12,
            maxWidth: 780,
          }}
        >
          Every venue sells the same product: proximity. A cabinet next to the matching engine, a validator in the right AWS region, the cross-connect the institutional desk already paid for, the order flow auctioned before it touches a public book. Each foundation insists the door is open. None of them publishes the price.
        </p>
      </Reveal>

      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        style={{ marginTop: 36 }}
      >
        {COLO_VENUES.map((v, i) => (
          <ColoCard key={v.slug} v={v} delay={Math.min(i * 0.06, 0.2)} />
        ))}
      </div>

      <Reveal delay={0.24}>
        <div
          style={{
            marginTop: 48,
            padding: '32px 28px',
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: 32,
              alignItems: 'start',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Latency · {LATENCY_ROWS.length} sourced · ms
              </div>
              <h3
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: TEXT,
                  marginBottom: 10,
                }}
              >
                Unfair colocation
              </h3>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 13,
                  color: SECONDARY,
                  letterSpacing: '-0.011em',
                  lineHeight: 1.55,
                  marginBottom: 10,
                }}
              >
                Retail baseline = 0. Bar = MM latency edge over retail at this venue, in milliseconds.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                {LATENCY_ROWS.length} sourced
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {LATENCY_ROWS.slice().sort((a, b) => b.edgeMs - a.edgeMs).map(row => (
                <LatencyBarRow key={row.slug} row={row} />
              ))}
              <GeneralMarketRow />
            </div>
          </div>

          {/* Source footer cards — same format as edge matrix */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${LINE}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '14px 22px',
            }}
          >
            {LATENCY_ROWS.slice().sort((a, b) => b.edgeMs - a.edgeMs).map(row => (
              <div
                key={row.slug}
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                  lineHeight: 1.5,
                }}
              >
                <div
                  style={{
                    color: TEXT,
                    fontWeight: 600,
                    marginBottom: 3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.name}{' '}
                  <span style={{ color: TERTIARY, fontWeight: 400 }}>· +{row.edgeMs}ms</span>
                </div>
                <div style={{ marginBottom: 4, fontStyle: 'italic', color: SECONDARY }}>
                  {row.lane}
                </div>
                <div style={{ marginBottom: 4, color: SECONDARY, fontStyle: 'italic' }}>
                  Mechanism: {row.barrier}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {row.source && (
                    <a
                      href={row.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: ACCENT, fontSize: 11, fontWeight: 500 }}
                      className="hover:underline"
                    >
                      {row.source.label} ›
                    </a>
                  )}
                  {row.barrierSource && row.barrierSource.url !== row.source?.url && (
                    <a
                      href={row.barrierSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: ACCENT, fontSize: 11, fontWeight: 500 }}
                      className="hover:underline"
                    >
                      {row.barrierSource.label} ›
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <AssumptionsBlock />
        </div>
      </Reveal>
    </section>
  )
}

interface AssumptionRow {
  metric: string
  value: string
  source: { label: string; url: string }
}

const INSIDE_LANE: AssumptionRow[] = [
  {
    metric: 'Citadel Securities — execution at the matching engine',
    value: '~10 microseconds',
    source: { label: 'QuantVPS', url: 'https://www.quantvps.com/blog/top-10-high-frequency-trading-firms-dominating-global-markets' },
  },
  {
    metric: 'Citadel Securities — share of US retail equity order flow',
    value: '~40%',
    source: { label: 'Trade Ideas', url: 'https://www.trade-ideas.com/2025/05/10/citadel-securities-the-invisible-hand-behind-retail-trading/' },
  },
  {
    metric: 'Top 3 wholesalers (Citadel, Virtu, G1) — share of retail orders',
    value: '>80%',
    source: { label: 'Global Trading', url: 'https://www.globaltrading.net/payment-for-us-retail-flow-reaches-record-high-led-by-citadel-securities-imc/' },
  },
  {
    metric: 'Jump Trading — private microwave backbone, inter-city',
    value: '~90 microseconds',
    source: { label: 'QuantVPS', url: 'https://www.quantvps.com/blog/top-10-high-frequency-trading-firms-dominating-global-markets' },
  },
  {
    metric: 'FPGA tick-to-trade at the colocated cabinet',
    value: '100–500 nanoseconds',
    source: { label: 'QuantVPS · FPGA', url: 'https://www.quantvps.com/blog/high-frequency-trading-with-fpgas' },
  },
  {
    metric: 'CME Aurora colocation rack — monthly rent + setup + cross-connect',
    value: '$12,000/mo + $2,000 + $350–550',
    source: { label: 'Lime Trading', url: 'https://lime.co/how-to-maximize-the-roi-of-colocation/' },
  },
]

const OUTSIDE_LANE: AssumptionRow[] = [
  {
    metric: 'Specialist forex / algo VPS — monthly rent',
    value: '$15–100 / month',
    source: { label: 'QuantVPS', url: 'https://www.quantvps.com/blog/best-vps-for-trading' },
  },
  {
    metric: 'Best-case retail VPS ping to broker matching engine (LD4 / NY4 tenant)',
    value: '1–5 ms',
    source: { label: 'QuantVPS · low latency', url: 'https://www.quantvps.com/blog/low-latency-trading' },
  },
  {
    metric: 'Generic cloud VPS (Hetzner, DO, AWS general region)',
    value: '10–50 ms',
    source: { label: 'LuxAlgo · latency standards', url: 'https://www.luxalgo.com/blog/latency-standards-in-trading-systems/' },
  },
  {
    metric: 'Latency above which HFT strategies become unprofitable — retail ceiling',
    value: '>10 ms',
    source: { label: 'LuxAlgo · latency standards', url: 'https://www.luxalgo.com/blog/latency-standards-in-trading-systems/' },
  },
  {
    metric: 'CPU tick-to-trade ceiling, even with optimised code (vs FPGA)',
    value: '3–8 microseconds',
    source: { label: 'QuantVPS · FPGA', url: 'https://www.quantvps.com/blog/high-frequency-trading-with-fpgas' },
  },
  {
    metric: 'Retail share of the algorithmic trading market, 2026',
    value: '38.5%',
    source: { label: 'Coherent Market Insights', url: 'https://www.coherentmarketinsights.com/market-insight/algorithmic-trading-market-2476' },
  },
  {
    metric: 'Cloud-hosted execution share of retail algo trading',
    value: '59.8%',
    source: { label: 'Coherent Market Insights', url: 'https://www.coherentmarketinsights.com/market-insight/algorithmic-trading-market-2476' },
  },
  {
    metric: 'Private microwave inter-city backbone',
    value: 'None — fibre only',
    source: { label: 'QuantVPS · HFT firms', url: 'https://www.quantvps.com/blog/top-10-high-frequency-trading-firms-dominating-global-markets' },
  },
]

function AssumptionLane({ title, summary, rows }: { title: string; summary: string; rows: AssumptionRow[] }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          color: TEXT,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          color: TERTIARY,
          letterSpacing: '-0.005em',
          lineHeight: 1.55,
          marginBottom: 12,
        }}
      >
        {summary}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              lineHeight: 1.5,
            }}
          >
            <div style={{ color: TEXT }}>
              {r.metric} —{' '}
              <span style={{ fontVariantNumeric: 'tabular-nums', color: ACCENT }}>{r.value}</span>
            </div>
            <a
              href={r.source.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: ACCENT, fontSize: 10, fontWeight: 500 }}
              className="hover:underline"
            >
              {r.source.label} ›
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

function AssumptionsBlock() {
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: `1px solid ${LINE}`,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          color: TEXT,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Assumptions
      </div>
      <div
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          color: TERTIARY,
          letterSpacing: '-0.005em',
          lineHeight: 1.6,
          marginBottom: 18,
        }}
      >
        Two endpoints. The lane that pays for everything, against the one that pays for nothing. Each number is sourced; the gap between them is what the bars above measure.
      </div>
      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ gap: 24 }}
      >
        <AssumptionLane
          title="Inside lane — maxed-out market maker"
          summary="Colocated cabinet, FPGA at the cable, microwave between cities, designated-MM contract, retail order flow auctioned before it touches a public book."
          rows={INSIDE_LANE}
        />
        <AssumptionLane
          title="Outside lane — retail algo trader (already paying)"
          summary="Not a phone clicker. An EA on MetaTrader, a Python bot on a VPS, sometimes the same building as the matching engine. Pays for infrastructure. Still arrives after the cabinet."
          rows={OUTSIDE_LANE}
        />
      </div>
    </div>
  )
}
