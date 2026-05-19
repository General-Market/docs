import { Reveal } from '@/components/ui/Reveal'
import { computeVenueBleeds } from './data-venue-bleed'

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
  const values = rows.map(r => r.bpsPerTrade * TRADES)
  const max = Math.max(...values)
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
            fontWeight: 600,
            color: TERTIARY,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Bleed · 1,000 trades
        </div>
      </Reveal>

      <Reveal mask delay={0.04}>
        <h2
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(32px, 4.2vw, 48px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
            lineHeight: 1.0833,
            color: TEXT,
            maxWidth: 820,
          }}
        >
          The minimum edge to finish flat at 1,000 trades.
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
          Per venue, sum the mechanisms that apply. Each is already amortized by how often it
          fires. Multiply by 1,000 trades. That is the favourable edge a retail trader would need
          cumulatively, just to finish flat against the maxed-out market maker on the other side.
          On {worst.name} it is {fmtPct(worst.bpsPerTrade * TRADES)}.
        </p>
      </Reveal>

      <Reveal delay={0.18}>
        <figure
          role="img"
          aria-label={`Cumulative bleed in percent at 1000 trades, ${rows.length} venues`}
          style={{ marginTop: 36, marginBottom: 0 }}
        >
          <div
            style={{
              padding: '28px 28px 20px',
              background: 'var(--apple-panel)',
              border: `1px solid ${LINE}`,
              borderRadius: 'var(--apple-r-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                fontWeight: 600,
                color: TERTIARY,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Cumulative bleed · % over 1,000 round-trips
            </div>

            {rows.map(v => {
              const cum = v.bpsPerTrade * TRADES
              const pct = (cum / max) * 100
              return (
                <div
                  key={v.slug}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px, 220px) 1fr minmax(96px, 112px)',
                    columnGap: 18,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div
                      style={{
                        fontFamily: 'var(--apple-font-text)',
                        fontSize: 15,
                        color: TEXT,
                        fontWeight: 600,
                        letterSpacing: '-0.016em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {v.name}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--apple-font-text)',
                        fontSize: 12,
                        color: SECONDARY,
                        letterSpacing: '-0.005em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {v.mm} · {fmtBps(v.bpsPerTrade)}/trade
                    </div>
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      height: 24,
                      background: SURFACE,
                      borderRadius: 'var(--apple-r-pill)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${Math.max(1, pct)}%`,
                        background: `linear-gradient(90deg, ${ACCENT}, #2997FF)`,
                        borderRadius: 'var(--apple-r-pill)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--apple-font-display)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 17,
                      fontWeight: 600,
                      letterSpacing: 'var(--apple-track-tighter)',
                      color: ACCENT,
                    }}
                  >
                    {fmtPct(cum)}
                  </div>
                </div>
              )
            })}

            {/* Axis */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 220px) 1fr minmax(96px, 112px)',
                columnGap: 18,
                marginTop: 4,
              }}
            >
              <div />
              <div style={{ position: 'relative', height: 16 }}>
                {[0, 0.25, 0.5, 1].map((t, i) => (
                  <span
                    key={t}
                    style={{
                      position: 'absolute',
                      left: `${t * 100}%`,
                      transform:
                        i === 0
                          ? 'translateX(0)'
                          : i === 3
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 11,
                      color: TERTIARY,
                      letterSpacing: '+0.011em',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmtPct(max * t)}
                  </span>
                ))}
              </div>
              <div />
            </div>
          </div>
          <figcaption
            style={{
              marginTop: 14,
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '+0.011em',
              textAlign: 'right',
            }}
          >
            Frequency-adjusted · retail baseline = 0
          </figcaption>
        </figure>
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
          Per-trade bps come from the fourteen mechanisms below, each weighted by how often it
          actually fires. Listing front-running is massive when it lands but rare per trade, so it
          contributes little to the per-venue total. Fees and PFOF fire every trade, so they
          dominate.
        </p>
      </Reveal>
    </section>
  )
}
