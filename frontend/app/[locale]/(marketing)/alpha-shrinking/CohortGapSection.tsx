import { Reveal } from '@/components/ui/Reveal'
import { COHORT_ROWS } from './data-cohort-gap'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

// Each row gets its own normalization so the visual comparison is honest:
// the *before* and *after* bars share a scale within a row.

export function CohortGapSection() {
  return (
    <section
      id="cohort-gap"
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
                Same funds. Adjacent cohorts. Twice as bad.
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
                The skeptic's reply to "retail loses" is "retail always lost."
                Here are the same instruments, two adjacent five-year windows,
                the cohort of the second window timing them visibly worse than
                the cohort of the first.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                Four independent panels. All pointing the same direction.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {COHORT_ROWS.map((row, i) => (
                <CohortPanel key={row.metric} row={row} index={i} />
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function CohortPanel({ row, index }: { row: (typeof COHORT_ROWS)[number]; index: number }) {
  // Per-row max so the visual is calibrated within the panel.
  const maxVal = Math.max(row.before.value, row.after.value, 0.1)
  const beforePct = (row.before.value / maxVal) * 100
  const afterPct = (row.after.value / maxVal) * 100

  return (
    <Reveal delay={index * 0.05}>
      <div
        style={{
          padding: 16,
          background: SURFACE,
          border: `1px solid ${LINE}`,
          borderRadius: 'var(--apple-r-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.016em',
              color: TEXT,
            }}
          >
            {row.metric}
          </h3>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.011em',
              color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {row.changeText}
          </span>
        </div>

        <CohortBar
          label={row.before.window}
          value={row.before.value}
          unit={row.before.unit}
          pct={beforePct}
          tone="before"
        />
        <CohortBar
          label={row.after.window}
          value={row.after.value}
          unit={row.after.unit}
          pct={afterPct}
          tone="after"
        />

        <a
          href={row.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: ACCENT,
            letterSpacing: '-0.005em',
            fontWeight: 500,
            alignSelf: 'flex-start',
          }}
          className="hover:underline"
        >
          {row.sourceLabel} ›
        </a>
      </div>
    </Reveal>
  )
}

function CohortBar({
  label,
  value,
  unit,
  pct,
  tone,
}: {
  label: string
  value: number
  unit: string
  pct: number
  tone: 'before' | 'after'
}) {
  const formatted =
    Math.abs(value) >= 100
      ? value.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : value.toFixed(2).replace(/\.?0+$/, '')

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 180px',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            position: 'relative',
            height: 16,
            background: 'var(--apple-panel)',
            borderRadius: 3,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${Math.max(1, pct)}%`,
              background: ACCENT,
              opacity: tone === 'before' ? 0.42 : 1,
              borderRadius: 3,
            }}
          />
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--apple-font-display)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 14,
          fontWeight: 600,
          color: tone === 'after' ? ACCENT : TEXT,
          letterSpacing: '-0.011em',
          textAlign: 'right',
        }}
      >
        {formatted}{' '}
        <span style={{ color: TERTIARY, fontWeight: 400, fontSize: 12 }}>{unit}</span>
      </div>
    </div>
  )
}
