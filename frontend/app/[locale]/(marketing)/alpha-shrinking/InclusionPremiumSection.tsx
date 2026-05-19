import { Reveal } from '@/components/ui/Reveal'
import { INCLUSION_BARS, DELETION_BARS, INCLUSION_SOURCE } from './data-inclusion'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

// Use the max absolute value across both panels to scale both.
const MAX_ABS = Math.max(
  ...INCLUSION_BARS.map(b => Math.abs(b.value)),
  ...DELETION_BARS.map(b => Math.abs(b.value)),
)

export function InclusionPremiumSection() {
  return (
    <section
      id="inclusion-premium"
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
                The cleanest alpha, killed in plain sight
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
                When the S&P 500 announces a new addition, the stock used to jump 7%
                on its way to inclusion. Anyone with a brokerage account could buy the
                announcement. Greenwood and Sammon measured the premium falling
                decade by decade. By the 2010s it was a rounding error.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                A 37-year retail-readable anomaly. Dead.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <PanelBars
                heading="Additions"
                subheading="Excess return on stocks newly added to the S&P 500"
                bars={INCLUSION_BARS}
                sign="positive"
              />
              <PanelBars
                heading="Deletions"
                subheading="Excess return on stocks removed from the S&P 500"
                bars={DELETION_BARS}
                sign="negative"
              />

              <div
                style={{
                  paddingTop: 16,
                  borderTop: `1px solid ${LINE}`,
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  color: SECONDARY,
                  letterSpacing: '-0.011em',
                  lineHeight: 1.55,
                  fontStyle: 'italic',
                }}
              >
                Passive flows changed the marginal buyer. The trade migrated into the
                futures, before the index even calls it.
                <br />
                <a
                  href={INCLUSION_SOURCE.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: ACCENT, fontWeight: 500, fontStyle: 'normal' }}
                  className="hover:underline"
                >
                  {INCLUSION_SOURCE.label} ›
                </a>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function PanelBars({
  heading,
  subheading,
  bars,
  sign,
}: {
  heading: string
  subheading: string
  bars: typeof INCLUSION_BARS
  sign: 'positive' | 'negative'
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
          gap: 12,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.011em',
            color: TEXT,
          }}
        >
          {heading}
        </h3>
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: TERTIARY,
            letterSpacing: '-0.005em',
          }}
        >
          {subheading}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bars.map(bar => {
          const pct = Math.max(1.5, (Math.abs(bar.value) / MAX_ABS) * 100)
          return (
            <div
              key={bar.decade}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 76px',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  color: TEXT,
                  letterSpacing: '-0.005em',
                  fontWeight: 500,
                }}
              >
                {bar.decade}
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
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    background: ACCENT,
                    opacity: pct < 5 ? 0.85 : pct < 20 ? 0.6 : 1,
                    borderRadius: 3,
                  }}
                />
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontFamily: 'var(--apple-font-display)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 13,
                  fontWeight: 600,
                  color: ACCENT,
                  letterSpacing: '-0.011em',
                }}
              >
                {sign === 'negative' && bar.value < 0 ? '' : sign === 'positive' && bar.value > 0 ? '+' : ''}
                {bar.value.toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
