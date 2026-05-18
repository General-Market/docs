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

const MAX_GAP = Math.max(...COLO_VENUES.map(v => v.outsiderMs - v.insiderMs))

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

function BarRow({
  label,
  value,
  pct,
  filled,
  note,
}: {
  label: string
  value: number
  pct: number
  filled: boolean
  note?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          flex: '0 0 132px',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 14,
          color: TEXT,
          letterSpacing: '-0.011em',
          fontWeight: 500,
        }}
      >
        {label}
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
        {filled && pct > 0 && (
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
          flex: '0 0 120px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: filled ? ACCENT : TERTIARY,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
        }}
      >
        {note ?? `${value}ms`}
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
          The receipts that aren't even illegal · 3 venues · no published prices
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
          Every venue sells the same product: proximity. A cabinet next to the matching engine, a validator in the right AWS region, the cross-connect the institutional desk already paid for. Each foundation insists the door is open. None of them publishes the price.
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
            The front-runner edge, measured in milliseconds
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {COLO_VENUES.map((v) => {
              const gap = v.outsiderMs - v.insiderMs
              return (
                <BarRow
                  key={v.slug}
                  label={v.name}
                  value={gap}
                  pct={(gap / MAX_GAP) * 100}
                  filled
                />
              )
            })}
            <BarRow
              label="General Market"
              value={0}
              pct={0}
              filled={false}
              note="No house"
            />
          </div>

          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              lineHeight: 1.5,
              marginTop: 24,
              paddingTop: 16,
              borderTop: `1px solid ${LINE}`,
            }}
          >
            Bar length = round-trip gap between the insider seat and the outside trader. Polymarket: KYC&apos;d London colo (~2ms) vs New York retail (~80ms), per Polymarket docs. Hyperliquid: Tokyo desk (~3ms) vs European desk (~200ms), per Glassnode / Coindesk, 30 March 2026. Kalshi: Chicago designated MM (~1ms) vs retail browser (~50ms), per BusinessWire announcement and the November 2025 federal complaint. General Market: on-chain, sealed bets, parimutuel, BLS-verified — no insider seat to sell.
          </div>
        </div>
      </Reveal>
    </section>
  )
}
