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

type Mechanism = 'colo' | 'region' | 'designated' | 'cross-connect' | 'pfof' | 'b-book' | 'none'

interface LatencyRow {
  slug: string
  name: string
  edgeMs: number
  mechanism: Mechanism
  lane: string
  source?: { label: string; url: string }
}

const MECH_LABEL: Record<Mechanism, string> = {
  'colo': 'Colocation',
  'region': 'AWS region',
  'designated': 'Designated MM',
  'cross-connect': 'Cross-connect',
  'pfof': 'PFOF',
  'b-book': 'Internal book',
  'none': 'None',
}

const LATENCY_ROWS: LatencyRow[] = [
  {
    slug: 'hyperliquid', name: 'Hyperliquid', edgeMs: 197, mechanism: 'region',
    lane: 'Tokyo desk vs European desk',
    source: { label: 'Coindesk · Glassnode', url: 'https://www.coindesk.com/markets/2026/03/30/hyperliquid-traders-in-tokyo-get-200-millisecond-edge-glassnode-research-shows' },
  },
  {
    slug: 'binance', name: 'Binance', edgeMs: 145, mechanism: 'colo',
    lane: 'AWS Tokyo VIP colo vs global retail',
    source: { label: 'NYC Servers · Tokyo VPS', url: 'https://newyorkcityservers.com/binance-vps' },
  },
  {
    slug: 'bybit', name: 'Bybit', edgeMs: 140, mechanism: 'colo',
    lane: 'AWS Singapore/Tokyo colo vs global retail',
    source: { label: 'Bybit · institutional', url: 'https://www.bybit.com/en/help-center/article/Bybit-Institutional-Services' },
  },
  {
    slug: 'pumpfun', name: 'Pump.fun', edgeMs: 130, mechanism: 'region',
    lane: 'Solana validator-adjacent snipers vs default RPC',
    source: { label: 'Helius · Solana latency', url: 'https://www.helius.dev/blog/solana-rpc-latency' },
  },
  {
    slug: 'etoro', name: 'eToro', edgeMs: 100, mechanism: 'b-book',
    lane: 'Internal CFD book — order never reaches a public market',
    source: { label: 'ASIC v eToro', url: 'https://asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-209mr-asic-sues-etoro-for-design-and-distribution-failings-and-misleading-conduct-relating-to-its-cfd-product/' },
  },
  {
    slug: 'polymarket', name: 'Polymarket', edgeMs: 78, mechanism: 'colo',
    lane: 'KYC\'d London colo vs New York retail',
    source: { label: 'docs.polymarket.com', url: 'https://docs.polymarket.com/trading/overview' },
  },
  {
    slug: 'deribit', name: 'Deribit', edgeMs: 75, mechanism: 'colo',
    lane: 'London matching engine colo vs US retail',
    source: { label: 'Deribit · institutional', url: 'https://www.deribit.com/kb/api-overview' },
  },
  {
    slug: 'fxcfd', name: 'FX / CFD industry', edgeMs: 65, mechanism: 'cross-connect',
    lane: 'NY4 (Equinix Secaucus) LP cross-connect vs retail home internet',
    source: { label: 'Equinix · NY4', url: 'https://www.equinix.com/data-centers/americas-colocation/united-states-colocation/new-york-data-centers/ny4' },
  },
  {
    slug: 'coinbase', name: 'Coinbase', edgeMs: 60, mechanism: 'colo',
    lane: 'Coinbase Prime us-east-1 / Equinix LD4 vs Asian or EU retail',
    source: { label: 'Coinbase · Prime', url: 'https://prime.coinbase.com/' },
  },
  {
    slug: 'ibkr', name: 'Interactive Brokers', edgeMs: 50, mechanism: 'cross-connect',
    lane: 'Direct Market Access pro vs retail SmartRouter',
    source: { label: 'IBKR · DMA', url: 'https://www.interactivebrokers.com/en/trading/orders/smartRouting.php' },
  },
  {
    slug: 'kalshi', name: 'Kalshi', edgeMs: 49, mechanism: 'designated',
    lane: 'Chicago designated MM vs retail browser',
    source: { label: 'Bloomberg · class action', url: 'https://www.bloomberg.com/news/articles/2025-11-28/kalshi-market-maker-bets-against-consumers-lawsuit-alleges' },
  },
  {
    slug: 'robinhood', name: 'Robinhood', edgeMs: 35, mechanism: 'pfof',
    lane: 'Citadel PFOF info window vs lit-market execution',
    source: { label: 'SEC · Robinhood PFOF', url: 'https://www.sec.gov/newsroom/press-releases/2020-321' },
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

function MechanismPill({ mechanism }: { mechanism: Mechanism }) {
  if (mechanism === 'none') return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--apple-r-pill)',
        background: 'var(--apple-surface)',
        color: TERTIARY,
        fontFamily: 'var(--apple-font-text)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {MECH_LABEL[mechanism]}
    </span>
  )
}

function LatencyBarRow({ row }: { row: LatencyRow }) {
  const pct = (row.edgeMs / MAX_EDGE) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          flex: '0 0 200px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.name}
        </span>
        <MechanismPill mechanism={row.mechanism} />
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: 'var(--apple-surface)',
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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
      </div>
      <div
        style={{
          flex: '0 0 72px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: ACCENT,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
        }}
      >
        {row.edgeMs}ms
      </div>
    </div>
  )
}

function GeneralMarketRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          flex: '0 0 200px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 600,
          }}
        >
          General Market
        </span>
        <MechanismPill mechanism="none" />
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: 'var(--apple-surface)',
          borderRadius: 4,
        }}
      />
      <div
        style={{
          flex: '0 0 72px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: TERTIARY,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
        }}
      >
        0ms
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
          The Edge They Sell to Insiders.
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
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              marginBottom: 4,
            }}
          >
            The front-runner edge, measured in milliseconds · {LATENCY_ROWS.length + 1} venues
          </div>
          <h3
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: TEXT,
              marginBottom: 28,
            }}
          >
            How far ahead the inside lane sits.
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {LATENCY_ROWS.map((row) => (
              <LatencyBarRow key={row.slug} row={row} />
            ))}
            <GeneralMarketRow />
          </div>

          {/* Source attribution block */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${LINE}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '12px 20px',
            }}
          >
            {LATENCY_ROWS.map((row) => (
              <div
                key={row.slug}
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ color: TEXT, fontWeight: 500, marginBottom: 2 }}>
                  {row.name} · {row.edgeMs}ms
                </div>
                <div style={{ marginBottom: 4 }}>{row.lane}</div>
                {row.source && (
                  <a
                    href={row.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: ACCENT,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                    className="hover:underline"
                  >
                    {row.source.label} ›
                  </a>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              lineHeight: 1.6,
              marginTop: 20,
              paddingTop: 16,
              borderTop: `1px solid ${LINE}`,
            }}
          >
            Bar length = round-trip latency edge between the insider seat and the outside trader, in milliseconds. Numbers reflect the dominant axis at each venue: same-region AWS proximity (Hyperliquid validator cluster, Binance/Bybit VIP colo, Pump.fun Solana sniper, Coinbase Prime, Deribit, Polymarket), Chicago cross-connect for designated MMs (Kalshi), DMA cross-connect or LP fibre for traditional brokers (IBKR, FX/CFD), payment-for-order-flow holding window (Robinhood/Citadel), and the internal CFD book where the order never reaches a public market (eToro). General Market: on-chain, sealed bets, parimutuel pools, BLS-verified oracles. No insider seat, no published price, no door.
          </div>
        </div>
      </Reveal>
    </section>
  )
}
