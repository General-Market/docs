import { Reveal } from '@/components/ui/Reveal'
import { DECAY_STACK } from './data-decay-stack'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

// We use a piecewise scale: 0 → 20% linearly, 20 → 100% logarithmically.
// Otherwise DeFi-yield (150% peak) flattens every classical bar to nothing.
function scale(value: number): number {
  const abs = Math.abs(value)
  if (abs <= 20) return (abs / 20) * 60                  // 0 → 60% of bar width
  const over = Math.log10(abs / 20)                       // 1× → 0; 10× → 1
  return 60 + Math.min(40, over * 25)
}

function fmtReturn(v: number): string {
  if (v === 0) return '0%'
  if (Math.abs(v) >= 100) return `${v.toFixed(0)}%`
  if (Math.abs(v) >= 10) return `${v.toFixed(1).replace(/\.0$/, '')}%`
  return `${v.toFixed(1)}%`
}

// Ranked by *magnitude of decay*: how much was lost, not how big the peak was.
const RANKED = [...DECAY_STACK]
  .map(r => ({ ...r, decay: r.peakReturn - r.currentReturn }))
  .sort((a, b) => b.decay - a.decay)

export function DecayStackSection() {
  return (
    <section
      id="decay-stack"
      style={{
        paddingTop: 80,
        paddingBottom: 24,
        borderTop: `1px solid ${LINE}`,
        scrollMarginTop: 80,
      }}
    >
      <Reveal delay={0.04}>
        <div
          className="ash-chart-panel"
          style={{
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div className="ash-chart-grid">
            <div>
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
                Each alpha, at peak and at present
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
                The faded bar is the return as published. The solid bar is the
                most recent measurement. Ranked by collapse, largest first.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                {RANKED.length} anomalies. Scale is linear under 20%, logarithmic above.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {RANKED.map((row, i) => (
                <DecayRowComp key={row.slug} row={row} index={i} />
              ))}
            </div>
          </div>

          {/* Footer cards */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${LINE}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px 22px',
            }}
          >
            {RANKED.map(row => (
              <div
                key={row.slug}
                id={`decay-${row.slug}`}
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                  lineHeight: 1.5,
                  scrollMarginTop: 80,
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
                    · died {row.diedYear}
                  </span>
                </div>
                <div style={{ marginBottom: 4, fontStyle: 'italic', color: SECONDARY }}>
                  {row.killedBy}
                </div>
                <a
                  href={row.killerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: ACCENT, fontSize: 11, fontWeight: 500 }}
                  className="hover:underline"
                >
                  {row.killerCite} ›
                </a>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function DecayRowComp({
  row,
  index,
}: {
  row: (typeof RANKED)[number]
  index: number
}) {
  const peakPct = scale(row.peakReturn)
  const currentPct = scale(row.currentReturn)

  return (
    <a
      href={`#decay-${row.slug}`}
      className="ash-bar-row"
      style={{ textDecoration: 'none' }}
    >
      <div
        className="ash-bar-label"
        style={{
          flex: '0 0 200px',
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: TERTIARY,
            letterSpacing: '+0.011em',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            flex: '0 0 22px',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
          }}
        >
          {row.name}
        </span>
      </div>

      <div
        className="ash-bar-track"
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
            top: 0,
            left: 0,
            bottom: 0,
            width: `${peakPct}%`,
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
            width: `${Math.max(0.5, currentPct)}%`,
            background: ACCENT,
            borderRadius: 4,
          }}
        />
      </div>

      <div
        className="ash-bar-value"
        style={{
          flex: '0 0 130px',
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
            color: TEXT,
          }}
        >
          {fmtReturn(row.peakReturn)} → {fmtReturn(row.currentReturn)}
        </div>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.005em',
            fontSize: 11,
            color: TERTIARY,
            marginTop: 2,
          }}
        >
          died {row.diedYear}
        </div>
      </div>
    </a>
  )
}
