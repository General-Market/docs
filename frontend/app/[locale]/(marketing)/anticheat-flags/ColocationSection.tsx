import { Reveal } from '@/components/ui/Reveal'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'

interface LatencyRow {
  slug: string
  name: string
  edgeMs: number
  gatedMs: number      // portion behind a real barrier (colo contract, paid feed, designated MM, capital gate, B-book)
  lane: string         // Retail: X | MM: Y form
  barrier: string      // single mechanism noun phrase
  source?: { label: string; url: string }
  barrierSource?: { label: string; url: string }
}

const LATENCY_ROWS: LatencyRow[] = [
  {
    slug: 'hyperliquid', name: 'Hyperliquid', edgeMs: 25, gatedMs: 25,
    lane: 'Retail (Tokyo VPS): public RPC | MM: Foundation-node gossip ahead of public RPC',
    barrier: 'Foundation node (10K HYPE staked, Tier 1 maker rebate, 98% uptime)',
    source: { label: 'Coindesk · Glassnode', url: 'https://www.coindesk.com/markets/2026/03/30/hyperliquid-traders-in-tokyo-get-200-millisecond-edge-glassnode-research-shows' },
    barrierSource: { label: 'Hyperliquid docs', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/nodes/foundation-non-validating-node' },
  },
  {
    slug: 'binance', name: 'Binance', edgeMs: 20, gatedMs: 5,
    lane: 'Retail (Tokyo VPS): ~25ms public API | MM (VIP 9): MMGW cross-connect ~5ms',
    barrier: 'VIP 9. $30B/30d futures + 5,500 BNB',
    source: { label: 'Binance · VIP eligibility', url: 'https://www.prnewswire.com/news-releases/binance-expands-vip-access-to-recognize-and-support-high-value-users-earlier-302716770.html' },
    barrierSource: { label: 'Binance · VIP program', url: 'https://www.binance.com/en/vip-institutional-services' },
  },
  {
    slug: 'bybit', name: 'Bybit', edgeMs: 15, gatedMs: 5,
    lane: 'Retail (Singapore VPS): ~20ms public API | MM (institutional): co-tenant in AWS Singapore',
    barrier: 'Institutional Services agreement',
    source: { label: 'Bybit · institutional', url: 'https://www.bybit.com/en/help-center/article/Bybit-Institutional-Services' },
    barrierSource: { label: 'Bybit · institutional', url: 'https://www.bybit.com/en/help-center/article/Bybit-Institutional-Services' },
  },
  {
    slug: 'pumpfun', name: 'Pump.fun', edgeMs: 50, gatedMs: 50,
    lane: 'Retail (free RPC): standard slot landing | MM: staked-connection + Jito bundle priority',
    barrier: 'Paid staked-connection RPC + Jito tip stack',
    source: { label: 'Helius · staked connections', url: 'https://www.helius.dev/staked-connections' },
    barrierSource: { label: 'Jito Labs · block engine', url: 'https://www.jito.wtf/' },
  },
  {
    slug: 'etoro', name: 'eToro', edgeMs: 100, gatedMs: 100,
    lane: 'Retail: order never reaches a public market | MM (eToro itself): is the book',
    barrier: 'B-book CFD counterparty',
    source: { label: 'ASIC v eToro', url: 'https://asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-209mr-asic-sues-etoro-for-design-and-distribution-failings-and-misleading-conduct-relating-to-its-cfd-product/' },
    barrierSource: { label: 'ASIC v eToro', url: 'https://asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-209mr-asic-sues-etoro-for-design-and-distribution-failings-and-misleading-conduct-relating-to-its-cfd-product/' },
  },
  {
    slug: 'polymarket', name: 'Polymarket', edgeMs: 5, gatedMs: 5,
    lane: 'Retail (eu-west-2 VPS): public WS | MM (KYC\'d): direct colo cross-connect',
    barrier: 'KYC/KYB approval + eu-west-2 colocation',
    source: { label: 'docs.polymarket.com', url: 'https://docs.polymarket.com/trading/overview' },
    barrierSource: { label: 'docs.polymarket.com', url: 'https://docs.polymarket.com/trading/overview' },
  },
  {
    slug: 'deribit', name: 'Deribit', edgeMs: 5, gatedMs: 5,
    lane: 'Retail (LD4-tenant VPS): public REST/WS | MM (institutional FIX): cage cross-connect',
    barrier: 'Pro institutional FIX gateway + MM agreement',
    source: { label: 'Deribit · institutional', url: 'https://www.deribit.com/kb/api-overview' },
    barrierSource: { label: 'Deribit · FIX', url: 'https://docs.deribit.com/?javascript#fix-api' },
  },
  {
    slug: 'coinbase', name: 'Coinbase', edgeMs: 5, gatedMs: 5,
    lane: 'Retail (us-east-1 VPS): public WS | MM (Prime): institutional FIX',
    barrier: 'Coinbase Prime onboarding + institutional FIX',
    source: { label: 'Coinbase · Prime', url: 'https://prime.coinbase.com/' },
    barrierSource: { label: 'Coinbase · Prime FIX', url: 'https://docs.cdp.coinbase.com/prime/docs/fix-api-overview' },
  },
  {
    slug: 'ibkr', name: 'IBKR', edgeMs: 50, gatedMs: 50,
    lane: 'Retail (SmartRouter): +50ms | MM (Pro DMA): direct market access',
    barrier: 'Pro/institutional capital + commercial agreement',
    source: { label: 'IBKR · DMA', url: 'https://www.interactivebrokers.com/en/trading/orders/smartRouting.php' },
    barrierSource: { label: 'IBKR · Pro DMA', url: 'https://www.interactivebrokers.com/en/general/finlearn/order-types-routing/ibkr-pro-direct-market-access.php' },
  },
  {
    slug: 'kalshi', name: 'Kalshi', edgeMs: 49, gatedMs: 0,
    lane: 'Retail (browser): +49ms | MM (designated): fee + position-limit privileges, infra unpublished',
    barrier: 'Designated MM contract (fee + position-limit privileges)',
    source: { label: 'Bloomberg · class action', url: 'https://www.bloomberg.com/news/articles/2025-11-28/kalshi-market-maker-bets-against-consumers-lawsuit-alleges' },
    barrierSource: { label: 'Kalshi · MM program', url: 'https://help.kalshi.com/en/articles/13823819-market-maker-program' },
  },
  {
    slug: 'robinhood', name: 'Robinhood', edgeMs: 35, gatedMs: 35,
    lane: 'Retail: lit-market execution | MM (Citadel): PFOF info window before book',
    barrier: 'Wholesaler internalization',
    source: { label: 'SEC · Robinhood PFOF', url: 'https://www.sec.gov/newsroom/press-releases/2020-321' },
    barrierSource: { label: 'SEC · Robinhood PFOF', url: 'https://www.sec.gov/newsroom/press-releases/2020-321' },
  },
]

const MAX_EDGE = Math.max(...LATENCY_ROWS.map(r => r.edgeMs))

function LatencyBarRow({ row }: { row: LatencyRow }) {
  const edgePct = Math.max((row.edgeMs / MAX_EDGE) * 100, row.edgeMs > 0 ? 2 : 0)
  const gatedPct = Math.max((row.gatedMs / MAX_EDGE) * 100, row.gatedMs > 0 ? 1.5 : 0)
  return (
    <div className="acf-bar-row">
      <div
        className="acf-bar-label"
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
        className="acf-bar-track"
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
        {edgePct > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${edgePct}%`,
              background: ACCENT,
              opacity: 0.32,
              borderRadius: 4,
            }}
          />
        )}
        {gatedPct > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${gatedPct}%`,
              background: ACCENT,
              borderRadius: 4,
            }}
          />
        )}
      </div>
      <div
        className="acf-bar-value"
        style={{
          flex: '0 0 100px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.016em',
            fontSize: 14,
            fontWeight: 600,
            color: ACCENT,
          }}
        >
          +{row.edgeMs}ms
        </div>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.005em',
            fontSize: 12,
            color: TERTIARY,
            marginTop: 2,
          }}
        >
          {row.gatedMs}ms gated
        </div>
      </div>
    </div>
  )
}

function GeneralMarketRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="acf-bar-row">
        <div
          className="acf-bar-label"
          style={{
            flex: '0 0 120px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 600,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt=""
            width={14}
            height={14}
            style={{ borderRadius: 3, flexShrink: 0 }}
          />
          General
        </div>
        <div
          className="acf-bar-track"
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
          className="acf-bar-value"
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
      <div
        className="acf-bar-caption"
        style={{
          paddingLeft: 132,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: SECONDARY,
          letterSpacing: '-0.005em',
          lineHeight: 1.45,
          fontStyle: 'italic',
        }}
      >
        Blocks last a minute. Order arrival inside the minute does not move the settlement.
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
          Geographic latency is buyable. A retail bot can rent a Tokyo VPS for around fifteen dollars a month and reach Binance public API in five milliseconds. The gap that survives that rental is the gated one: the MMGW cross-connect inside AWS Tokyo, the FIX cage at LD4, the Foundation-node gossip feed on Hyperliquid, the bilateral KYC at Polymarket. Each venue says the door is open, but none of them publishes the price of walking through it.
        </p>
      </Reveal>

      <Reveal delay={0.24}>
        <div
          className="acf-chart-panel"
          style={{
            marginTop: 48,
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div className="acf-chart-grid">
            <div>
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
                Bar = the latency gap that remains after a retail VPS is already running in the right AWS region. Solid inner = the portion gated behind a colocation contract, a designated-MM agreement, or KYC approval, which no rental can buy.
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

          {/* Source footer cards. Same format as edge matrix */}
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
                  <span style={{ color: TERTIARY, fontWeight: 400 }}>
                    · +{row.edgeMs}ms{' '}
                    <span style={{ opacity: 0.7 }}>· {row.gatedMs}ms gated</span>
                  </span>
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
    metric: 'Software trading firm. Tick-to-trade at the colocated cabinet',
    value: '~10 microseconds',
    source: { label: 'Solarflare/LDA · STAC-T0 benchmark', url: 'https://www.tradersmagazine.com/departments/technology/solarflare-and-lda-hit-120ns-cme-tick-to-trade-latency/' },
  },
  {
    metric: 'Citadel Securities. Share of US retail equity order flow',
    value: '~40%',
    source: { label: 'Schwab · 2022 order routing whitepaper', url: 'https://content.schwab.com/web/retail/public/about-schwab/Schwab-2022-order-routing-whitepaper.pdf' },
  },
  {
    metric: 'Top 3 wholesalers (Citadel, Virtu, G1). Share of retail orders',
    value: '>80%',
    source: { label: 'Federal Reserve · order routing study', url: 'https://www.federalreserve.gov/econres/feds/files/2024080pap.pdf' },
  },
  {
    metric: 'McKay Brothers private microwave. Aurora ↔ Carteret RTT',
    value: '~7.96 ms',
    source: { label: 'McKay Brothers · public latency', url: 'https://www.mckay-brothers.com/our-network/' },
  },
  {
    metric: 'FPGA tick-to-trade at the colocated cabinet',
    value: '96–500 nanoseconds',
    source: { label: 'Solarflare/LDA/Penguin · STAC-T0', url: 'https://www.tradersmagazine.com/departments/technology/solarflare-lda-and-penguin-slash-tick-to-trade-latency-to-96-nanoseconds/' },
  },
  {
    metric: 'CME Aurora colocation rack. Monthly rent + setup + cross-connect',
    value: 'Five-figure/mo + setup + cross-connect',
    source: { label: 'CME · co-location facility update', url: 'https://www.cmegroup.com/trading/files/co-location-facility-update.pdf' },
  },
]

const OUTSIDE_LANE: AssumptionRow[] = [
  {
    metric: 'Commodity cloud VPS. Monthly rent',
    value: '~$5–100 / month',
    source: { label: 'Hetzner Cloud · pricing', url: 'https://www.hetzner.com/cloud' },
  },
  {
    metric: 'Best-case retail VPS ping to broker matching engine (LD4 / NY4 tenant)',
    value: '1–5 ms',
    source: { label: 'Equinix · NY4 facility', url: 'https://www.equinix.com/data-centers/americas-colocation/united-states-colocation/new-york-data-centers/ny4' },
  },
  {
    metric: 'Generic cloud VPS (Hetzner, DO, AWS general region)',
    value: '10–50 ms',
    source: { label: 'LuxAlgo · latency standards', url: 'https://www.luxalgo.com/blog/latency-standards-in-trading-systems/' },
  },
  {
    metric: 'Latency above which HFT strategies become unprofitable. Retail ceiling',
    value: '>10 ms',
    source: { label: 'LuxAlgo · latency standards', url: 'https://www.luxalgo.com/blog/latency-standards-in-trading-systems/' },
  },
  {
    metric: 'CPU tick-to-trade ceiling, even with optimised code (vs FPGA)',
    value: '~2–8 microseconds',
    source: { label: 'Databento · microstructure', url: 'https://databento.com/microstructure/tick-to-trade' },
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
    value: 'None. Fibre only',
    source: { label: 'McKay Brothers · network', url: 'https://www.mckay-brothers.com/our-network/' },
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
              {r.metric}:{' '}
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
        Two endpoints: the lane that has paid for everything against the lane that has not. Each number below is sourced, and the gap between them is what the bars above are actually measuring.
      </div>
      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ gap: 24 }}
      >
        <AssumptionLane
          title="Inside lane. Maxed-out market maker"
          summary="Colocated cabinet, FPGA at the cable, microwave between cities, designated-MM contract, retail order flow auctioned before it touches a public book."
          rows={INSIDE_LANE}
        />
        <AssumptionLane
          title="Outside lane. Retail algo trader (already paying)"
          summary="A Python bot running on a Tokyo VPS, a node already in eu-west-2, or a tenant inside Equinix LD4. Retail that has already paid for proximity. The gap that remains is what no rental can buy: the cross-connect, the FIX cage, the Foundation-node gossip, the bilateral contract."
          rows={OUTSIDE_LANE}
        />
      </div>
    </div>
  )
}
