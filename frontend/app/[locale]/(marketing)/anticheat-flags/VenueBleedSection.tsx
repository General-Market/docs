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
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginBottom: 10,
          }}
        >
          {rows.length} venues · cumulative bleed at 1,000 round-trips · frequency-adjusted
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
          The Minimum Edge to Not Be in Negative at 1,000 Trades.
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
        <div
          role="img"
          aria-label={`Cumulative bleed in percent at 1000 trades, ${rows.length} venues`}
          style={{
            marginTop: 28,
            padding: '20px 20px 16px',
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {rows.map(v => {
            const cum = v.bpsPerTrade * TRADES
            const pct = (cum / max) * 100
            return (
              <div
                key={v.slug}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(190px, 220px) 1fr minmax(96px, 112px)',
                  columnGap: 16,
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <div
                    style={{
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 14,
                      color: TEXT,
                      fontWeight: 600,
                      letterSpacing: '-0.011em',
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
                      fontSize: 11,
                      color: TERTIARY,
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
                      width: `${Math.max(1, pct)}%`,
                      background: ACCENT,
                      borderRadius: 3,
                    }}
                  />
                </div>
                <div
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--apple-font-display)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 14,
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
          <div
            style={{
              marginTop: 8,
              paddingTop: 12,
              borderTop: `1px solid ${LINE}`,
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              textAlign: 'right',
            }}
          >
            cumulative % bleed over 1,000 round-trips · frequency-adjusted · retail = 0
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
          Per-trade bps come from the fourteen mechanisms below, each weighted by how often it
          actually fires. Listing front-running is massive when it lands but rare per trade, so it
          contributes little to the per-venue total. Fees and PFOF fire every trade, so they
          dominate.
        </p>
      </Reveal>
    </section>
  )
}
