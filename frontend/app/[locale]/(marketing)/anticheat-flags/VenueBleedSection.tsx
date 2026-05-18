import { Reveal } from '@/components/ui/Reveal'
import { computeVenueBleeds } from './data-venue-bleed'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

/**
 * Bars are log-scaled because the values span four orders of magnitude.
 * Log10 axis from 100 bps (1%) to 100,000,000 bps (10,000×). One decade per
 * gridline. The widths are visual; the labels carry the exact numbers.
 */
const LOG_MIN = Math.log10(100) // 1% = 100 bps
const LOG_MAX = Math.log10(100_000_000) // 10,000× = 100M bps

function widthPct(bps: number): number {
  if (bps <= 0) return 0
  const v = Math.max(LOG_MIN, Math.min(LOG_MAX, Math.log10(bps)))
  return ((v - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100
}

function fmtBps(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1).replace(/\.0$/, '')}M bps`
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1).replace(/\.0$/, '')}k bps`
  return `${bps} bps`
}

function fmtPct(bps: number): string {
  const pct = bps / 100
  if (pct >= 10_000) return `${(pct / 1000).toFixed(0)},${String(pct % 1000).padStart(3, '0').slice(0, 3)}%`
  if (pct >= 1_000) return `${pct.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`
  return `${pct.toFixed(0)}%`
}

const N_TINTS = [
  { label: '100 trades', opacity: 0.32 },
  { label: '1,000 trades', opacity: 0.6 },
  { label: '100,000 trades', opacity: 1.0 },
] as const

export function VenueBleedSection() {
  const rows = computeVenueBleeds()
  const worst = rows[0]

  return (
    <section
      id="venue-bleed"
      style={{
        paddingTop: 48,
        paddingBottom: 48,
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
          {rows.length} venues · ranked by per-trade bps · log-scaled
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
            maxWidth: 980,
          }}
        >
          The Minimum Edge to Not Be in Negative.
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
          Per venue, sum the mechanisms that are active. Multiply by trades. That is the favourable
          edge you would need — over 100, 1,000, and 100,000 round-trips — just to finish flat.
          On {worst.name}, breaking even after 100,000 trades requires beating the maxed-out market
          maker by {fmtPct(worst.cumulative.n100k)} cumulatively. Most traders do not.
        </p>
      </Reveal>

      {/* Legend */}
      <Reveal delay={0.14}>
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: SECONDARY,
            letterSpacing: '-0.005em',
          }}
        >
          {N_TINTS.map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 10,
                  background: ACCENT,
                  opacity: t.opacity,
                  borderRadius: 2,
                }}
              />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Chart */}
      <Reveal delay={0.18}>
        <div
          style={{
            marginTop: 24,
            padding: '20px 20px 16px',
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {rows.map(v => {
            const bars = [
              { value: v.cumulative.n100, tint: N_TINTS[0].opacity, label: '100' },
              { value: v.cumulative.n1k, tint: N_TINTS[1].opacity, label: '1k' },
              { value: v.cumulative.n100k, tint: N_TINTS[2].opacity, label: '100k' },
            ]
            return (
              <div
                key={v.slug}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(170px, 200px) 1fr',
                  columnGap: 20,
                  alignItems: 'center',
                }}
              >
                {/* Left: venue identity + per-trade bps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    style={{
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 14,
                      color: TEXT,
                      fontWeight: 600,
                      letterSpacing: '-0.011em',
                    }}
                  >
                    {v.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 11,
                      color: TERTIARY,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {v.mm}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--apple-font-display)',
                      fontSize: 13,
                      color: ACCENT,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: 'var(--apple-track-tighter)',
                      marginTop: 2,
                    }}
                  >
                    {v.bpsPerTrade} bps / trade
                  </div>
                </div>

                {/* Right: clustered triple bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bars.map((b, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'relative',
                        height: 18,
                        background: SURFACE,
                        borderRadius: 3,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${widthPct(b.value)}%`,
                          background: ACCENT,
                          opacity: b.tint,
                          borderRadius: 3,
                          minWidth: 2,
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 8px',
                          fontFamily: 'var(--apple-font-text)',
                          fontSize: 11,
                          color: TEXT,
                          letterSpacing: '-0.005em',
                          fontVariantNumeric: 'tabular-nums',
                          pointerEvents: 'none',
                        }}
                      >
                        <span style={{ color: TERTIARY, fontWeight: 600 }}>{b.label}</span>
                        <span style={{ fontWeight: 600 }}>
                          {fmtBps(b.value)} · {fmtPct(b.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <div
            style={{
              marginTop: 6,
              paddingTop: 12,
              borderTop: `1px solid ${LINE}`,
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
            }}
          >
            Bar widths are log-scaled — one decade per visual step. Numbers are exact.
            100 bps = 1%. 10,000 bps = 100%. 1M bps = 100×.
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.22}>
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            lineHeight: 1.55,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginTop: 16,
            maxWidth: 780,
          }}
        >
          Per-trade bps come from the fourteen mechanisms below, summed across the ones documented
          at each venue. The math is multiplication.
        </p>
      </Reveal>
    </section>
  )
}
