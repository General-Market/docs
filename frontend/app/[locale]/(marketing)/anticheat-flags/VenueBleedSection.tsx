import { Reveal } from '@/components/ui/Reveal'
import { computeVenueBleeds } from './data-venue-bleed'
import { EDGE_WAYS } from './data-edge-ways'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

const TRADES = 1_000

function fmtPct(bps: number): string {
  const pct = bps / 100
  if (pct >= 1_000) return `${pct.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
  if (pct >= 100) return `${pct.toFixed(0)}%`
  if (pct >= 10) return `${pct.toFixed(1).replace(/\.0$/, '')}%`
  return `${pct.toFixed(2).replace(/\.?0+$/, '')}%`
}

function fmtBps(bps: number): string {
  if (bps >= 10) return `${bps.toFixed(0)} bps`
  if (bps >= 1) return `${bps.toFixed(1).replace(/\.0$/, '')} bps`
  return `${bps.toFixed(2)} bps`
}

export function VenueBleedSection() {
  const rows = computeVenueBleeds()
  const max = Math.max(...rows.map(r => r.bpsPerTrade * TRADES))
  const mechanismName = new Map(EDGE_WAYS.map(w => [w.slug, w.name]))

  return (
    <section
      id="venue-bleed"
      style={{
        paddingTop: 80,
        paddingBottom: 24,
        scrollMarginTop: 80,
      }}
    >
      <Reveal delay={0.04}>
        <div
          style={{
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
                Bleed · {rows.length} sourced · %
              </div>
              <h2
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: 'var(--apple-track-tight)',
                  color: TEXT,
                  marginBottom: 10,
                }}
              >
                Minimum edge to break even at 1,000 trades
              </h2>
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
                Retail baseline = 0. Bar = cumulative % bleed over 1,000 round-trips, summed across every mechanism active at the venue, each weighted by how often it fires.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                {rows.length} sourced
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rows.map(v => {
                const cum1k = v.bpsPerTrade * TRADES
                const cum100 = v.bpsPerTrade * 100
                const lightPct = Math.max(1, (cum1k / max) * 100)
                const darkPct = Math.max(0.8, (cum100 / max) * 100)
                return (
                  <BleedRow
                    key={v.slug}
                    name={v.name}
                    lightPct={lightPct}
                    darkPct={darkPct}
                    value={fmtPct(cum1k)}
                    sub={`${fmtBps(v.bpsPerTrade)}/trade`}
                  />
                )
              })}
              <GeneralBaselineRow />
            </div>
          </div>

          {/* Source footer cards. Same format as Colocation */}
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
            {rows.map(v => (
              <div
                key={v.slug}
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
                  {v.name}{' '}
                  <span style={{ color: TERTIARY, fontWeight: 400 }}>
                    · {fmtPct(v.bpsPerTrade * TRADES)}{' '}
                    <span style={{ opacity: 0.7 }}>· {fmtBps(v.bpsPerTrade)}/trade</span>
                  </span>
                </div>
                <div style={{ marginBottom: 4, fontStyle: 'italic', color: SECONDARY }}>
                  Maxed-out MM: {v.mm}
                </div>
                <div style={{ color: SECONDARY, fontStyle: 'italic' }}>
                  Active: {v.active.map(s => mechanismName.get(s) ?? s).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function BleedRow({
  name,
  lightPct,
  darkPct,
  value,
  sub,
}: {
  name: string
  lightPct: number
  darkPct: number
  value: string
  sub: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          flex: '0 0 140px',
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
        {name}
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: SURFACE,
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
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${lightPct}%`,
            background: ACCENT,
            opacity: 0.32,
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${darkPct}%`,
            background: ACCENT,
            borderRadius: 4,
          }}
        />
      </div>
      <div
        style={{
          flex: '0 0 120px',
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
          {value}
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
          {sub}
        </div>
      </div>
    </div>
  )
}

function GeneralBaselineRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            flex: '0 0 140px',
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
          style={{
            flex: 1,
            height: 14,
            background: SURFACE,
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
            flex: '0 0 120px',
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
        style={{
          paddingLeft: 152,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: SECONDARY,
          letterSpacing: '-0.005em',
          lineHeight: 1.45,
          fontStyle: 'italic',
        }}
      >
        Sealed bets, parimutuel, BLS-verified oracles. No mechanism left to fire.
      </div>
    </div>
  )
}
