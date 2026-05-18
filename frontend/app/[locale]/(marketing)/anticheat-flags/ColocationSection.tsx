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
  edgeMs: number        // total geographic + structural edge over outsider retail
  gatedMs: number       // portion behind a real barrier (>$100/mo, contract, KYC, capital)
  mechanism: Mechanism
  lane: string
  barrier: string       // one phrase: what costs more than a $50 VPS in the same AWS region
  source?: { label: string; url: string }         // primary source for the latency claim
  barrierSource?: { label: string; url: string }  // primary source for the barrier claim
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
    slug: 'hyperliquid', name: 'Hyperliquid', edgeMs: 197, gatedMs: 2, mechanism: 'region',
    lane: 'Tokyo desk vs European desk',
    barrier: 'Foundation node — 10,000 HYPE staked + Tier-1 maker volume',
    source: { label: 'Coindesk · Glassnode', url: 'https://www.coindesk.com/markets/2026/03/30/hyperliquid-traders-in-tokyo-get-200-millisecond-edge-glassnode-research-shows' },
    barrierSource: { label: 'Hyperliquid docs', url: 'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/nodes/foundation-non-validating-node' },
  },
  {
    slug: 'binance', name: 'Binance', edgeMs: 145, gatedMs: 5, mechanism: 'colo',
    lane: 'AWS Tokyo VIP colo vs global retail',
    barrier: 'VIP 9 — $4B spot or $30B futures 30d volume + 5,500 BNB',
    source: { label: 'NYC Servers · Tokyo VPS', url: 'https://newyorkcityservers.com/binance-vps' },
    barrierSource: { label: 'Binance · VIP program', url: 'https://www.binance.com/en/vip-institutional-services' },
  },
  {
    slug: 'bybit', name: 'Bybit', edgeMs: 140, gatedMs: 5, mechanism: 'colo',
    lane: 'AWS Singapore/Tokyo colo vs global retail',
    barrier: 'Institutional Services agreement · dedicated FIX gateway',
    source: { label: 'Bybit · institutional', url: 'https://www.bybit.com/en/help-center/article/Bybit-Institutional-Services' },
    barrierSource: { label: 'Bybit · institutional', url: 'https://www.bybit.com/en/help-center/article/Bybit-Institutional-Services' },
  },
  {
    slug: 'pumpfun', name: 'Pump.fun', edgeMs: 130, gatedMs: 25, mechanism: 'region',
    lane: 'Solana validator-adjacent snipers vs default RPC',
    barrier: 'Jito bundles + tip auction · paid validator-adjacent RPC (Helius / QuickNode)',
    source: { label: 'Helius · Solana latency', url: 'https://www.helius.dev/blog/solana-rpc-latency' },
    barrierSource: { label: 'Jito Labs · block engine', url: 'https://www.jito.wtf/' },
  },
  {
    slug: 'etoro', name: 'eToro', edgeMs: 100, gatedMs: 100, mechanism: 'b-book',
    lane: 'Internal CFD book — order never reaches a public market',
    barrier: 'Broker-only — the entire edge is structural; no retail equivalent at any price',
    source: { label: 'ASIC v eToro', url: 'https://asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-209mr-asic-sues-etoro-for-design-and-distribution-failings-and-misleading-conduct-relating-to-its-cfd-product/' },
    barrierSource: { label: 'ASIC v eToro', url: 'https://asic.gov.au/about-asic/news-centre/find-a-media-release/2023-releases/23-209mr-asic-sues-etoro-for-design-and-distribution-failings-and-misleading-conduct-relating-to-its-cfd-product/' },
  },
  {
    slug: 'polymarket', name: 'Polymarket', edgeMs: 78, gatedMs: 3, mechanism: 'colo',
    lane: 'KYC\'d London colo vs New York retail',
    barrier: 'KYC/KYB form approval · direct colocation in eu-west-2',
    source: { label: 'docs.polymarket.com', url: 'https://docs.polymarket.com/trading/overview' },
    barrierSource: { label: 'docs.polymarket.com', url: 'https://docs.polymarket.com/trading/overview' },
  },
  {
    slug: 'deribit', name: 'Deribit', edgeMs: 75, gatedMs: 2, mechanism: 'colo',
    lane: 'London matching engine colo vs US retail',
    barrier: 'Pro institutional FIX gateway · MM agreement',
    source: { label: 'Deribit · institutional', url: 'https://www.deribit.com/kb/api-overview' },
    barrierSource: { label: 'Deribit · FIX', url: 'https://docs.deribit.com/?javascript#fix-api' },
  },
  {
    slug: 'fxcfd', name: 'FX / CFD industry', edgeMs: 65, gatedMs: 40, mechanism: 'cross-connect',
    lane: 'NY4 (Equinix Secaucus) LP cross-connect vs retail home internet',
    barrier: 'NY4 full cabinet $1.5–3k/mo + cross-connects $100–300/mo each + setup $500–1,500',
    source: { label: 'Equinix · NY4', url: 'https://www.equinix.com/data-centers/americas-colocation/united-states-colocation/new-york-data-centers/ny4' },
    barrierSource: { label: 'UPSTACK · NY4 pricing', url: 'https://marketplace.upstack.com/data-centers/equinix-colocation-new-jersey' },
  },
  {
    slug: 'coinbase', name: 'Coinbase', edgeMs: 60, gatedMs: 5, mechanism: 'colo',
    lane: 'Coinbase Prime us-east-1 / Equinix LD4 vs Asian or EU retail',
    barrier: 'Coinbase Prime onboarding · institutional FIX endpoint',
    source: { label: 'Coinbase · Prime', url: 'https://prime.coinbase.com/' },
    barrierSource: { label: 'Coinbase · Prime FIX', url: 'https://docs.cdp.coinbase.com/prime/docs/fix-api-overview' },
  },
  {
    slug: 'ibkr', name: 'Interactive Brokers', edgeMs: 50, gatedMs: 50, mechanism: 'cross-connect',
    lane: 'Direct Market Access pro vs retail SmartRouter',
    barrier: 'Pro / institutional account · capital + commercial agreement · no retail bypass',
    source: { label: 'IBKR · DMA', url: 'https://www.interactivebrokers.com/en/trading/orders/smartRouting.php' },
    barrierSource: { label: 'IBKR · Pro DMA', url: 'https://www.interactivebrokers.com/en/general/finlearn/order-types-routing/ibkr-pro-direct-market-access.php' },
  },
  {
    slug: 'kalshi', name: 'Kalshi', edgeMs: 49, gatedMs: 15, mechanism: 'designated',
    lane: 'Chicago designated MM vs retail browser',
    barrier: 'Designated MM contract — application, capital, reduced fees, adjusted position limits',
    source: { label: 'Bloomberg · class action', url: 'https://www.bloomberg.com/news/articles/2025-11-28/kalshi-market-maker-bets-against-consumers-lawsuit-alleges' },
    barrierSource: { label: 'Kalshi · MM program', url: 'https://help.kalshi.com/en/articles/13823819-market-maker-program' },
  },
  {
    slug: 'robinhood', name: 'Robinhood', edgeMs: 35, gatedMs: 35, mechanism: 'pfof',
    lane: 'Citadel PFOF info window vs lit-market execution',
    barrier: 'PFOF contract — Citadel only; not for sale at any retail price',
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
  const gatedPct = (row.gatedMs / row.edgeMs) * 100
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
        {/* Total edge — lighter accent (the part anyone can rent for <$100/mo) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${pct}%`,
            background: ACCENT,
            opacity: 0.32,
            borderRadius: 4,
          }}
        />
        {/* Gated edge — solid accent (the part behind a real barrier) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${pct * (gatedPct / 100)}%`,
            background: ACCENT,
            borderRadius: 4,
          }}
        />
      </div>
      <div
        style={{
          flex: '0 0 96px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          lineHeight: 1.05,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: ACCENT,
          }}
        >
          {row.edgeMs}ms
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: TERTIARY,
            marginTop: 2,
            fontFamily: 'var(--apple-font-text)',
            letterSpacing: '-0.005em',
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
          flex: '0 0 96px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          lineHeight: 1.05,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: TERTIARY,
          }}
        >
          0ms
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: TERTIARY,
            marginTop: 2,
            fontFamily: 'var(--apple-font-text)',
            letterSpacing: '-0.005em',
          }}
        >
          0ms gated
        </div>
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
              marginBottom: 8,
            }}
          >
            How far ahead the inside lane sits.
          </h3>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              color: SECONDARY,
              letterSpacing: '-0.011em',
              lineHeight: 1.5,
              marginBottom: 24,
              maxWidth: 720,
            }}
          >
            Solid bar = portion truly gated behind a barrier (contract, KYC, capital, dedicated FIX, PFOF deal, internal book). Faded bar = portion anyone can rent for under $100/month — a VPS in the same AWS region. The grey number names the barrier in milliseconds: how much of the edge is actually for sale only.
          </p>

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
                <div style={{ color: TEXT, fontWeight: 500, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {row.name} · <span style={{ color: ACCENT }}>{row.edgeMs}ms</span> ·{' '}
                  <span style={{ color: TERTIARY }}>{row.gatedMs}ms gated</span>
                </div>
                <div style={{ marginBottom: 4 }}>{row.lane}</div>
                <div style={{ marginBottom: 4, color: SECONDARY, fontStyle: 'italic' }}>
                  Barrier: {row.barrier}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 12px' }}>
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
                      Latency: {row.source.label} ›
                    </a>
                  )}
                  {row.barrierSource && row.barrierSource.url !== row.source?.url && (
                    <a
                      href={row.barrierSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: ACCENT,
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                      className="hover:underline"
                    >
                      Barrier: {row.barrierSource.label} ›
                    </a>
                  )}
                </div>
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
            Accent bar = total geographic + structural edge. Faded portion = what a $50/mo VPS in the same AWS region already gives anyone — no contract, no application, no KYC. Solid portion (and the grey "gated" number) = the part that genuinely costs more than $100/month to access: colocated cabinet, dedicated FIX gateway, designated-MM contract, capital-gated DMA, Citadel PFOF deal, or an internal CFD book retail can never bypass. For Hyperliquid, Binance, Bybit, Polymarket, Deribit, Coinbase: most of the visible edge is permissionless AWS-region proximity; the real barrier is a small marginal improvement on top. For eToro, Robinhood, IBKR, FX/CFD, Kalshi: every millisecond is gated — there is no public-market lane to rent. General Market: on-chain, sealed bets, parimutuel pools, BLS-verified oracles. No insider seat, no permissionless seat, no door.
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
