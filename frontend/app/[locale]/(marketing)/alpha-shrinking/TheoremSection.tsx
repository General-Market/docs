import { Reveal } from '@/components/ui/Reveal'
import { MCLEAN_PONTIFF } from './data-decay-stack'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

// Three-stage decay visual.
// Stage 1: in-sample return (the published number) — full bar.
// Stage 2: out-of-sample (post-publication-period data, pre-publication) — 74% of original.
// Stage 3: post-publication — 42% of original.
const STAGES = [
  { label: 'In-sample', value: 100, sub: 'return as published' },
  { label: 'Out-of-sample', value: 74, sub: `−${MCLEAN_PONTIFF.outOfSampleDecay}% decay` },
  { label: 'Post-publication', value: 42, sub: `−${MCLEAN_PONTIFF.postPublicationDecay}% from original` },
]

export function TheoremSection() {
  return (
    <section
      id="theorem"
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
                The theorem of decay
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
                McLean & Pontiff (Journal of Finance, 2016) tested {MCLEAN_PONTIFF.totalAnomaliesStudied} published
                return-predicting variables. Returns drop {MCLEAN_PONTIFF.outOfSampleDecay}% out-of-sample.
                Then they drop {MCLEAN_PONTIFF.postPublicationDecay}% post-publication. The gap between the two
                is the part attributable to investors reading the paper and trading the alpha away.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                Every retail-accessible edge follows this curve. Discovered. Published. Harvested. Dead.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {STAGES.map((stage, i) => (
                <StageRow
                  key={stage.label}
                  label={stage.label}
                  value={stage.value}
                  sub={stage.sub}
                  isFirst={i === 0}
                  isLast={i === STAGES.length - 1}
                />
              ))}

              <div
                style={{
                  marginTop: 8,
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
                "Investors learn. Capital crowds in. The spread closes."
                <br />
                <a
                  href={MCLEAN_PONTIFF.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: ACCENT, fontWeight: 500, fontStyle: 'normal' }}
                  className="hover:underline"
                >
                  {MCLEAN_PONTIFF.cite} ›
                </a>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function StageRow({
  label,
  value,
  sub,
  isFirst,
  isLast,
}: {
  label: string
  value: number
  sub: string
  isFirst: boolean
  isLast: boolean
}) {
  // Bar width is value%. Color intensifies from 0.4 -> 1.0 to 0.4 again (loss accent).
  const barColor = isFirst ? `color-mix(in srgb, ${ACCENT} 35%, transparent)` : ACCENT
  const labelColor = isLast ? ACCENT : isFirst ? TEXT : TEXT
  return (
    <div className="ash-bar-row">
      <div
        className="ash-bar-label"
        style={{
          flex: '0 0 180px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: labelColor,
            letterSpacing: '-0.011em',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: TERTIARY,
            letterSpacing: '-0.005em',
          }}
        >
          {sub}
        </span>
      </div>

      <div
        className="ash-bar-track"
        style={{
          flex: 1,
          height: 22,
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
            width: `${value}%`,
            background: barColor,
            borderRadius: 4,
          }}
        />
      </div>

      <div
        className="ash-bar-value"
        style={{
          flex: '0 0 60px',
          textAlign: 'right',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.016em',
            fontSize: 16,
            fontWeight: 600,
            color: isLast ? ACCENT : TEXT,
          }}
        >
          {value}%
        </div>
      </div>
    </div>
  )
}
