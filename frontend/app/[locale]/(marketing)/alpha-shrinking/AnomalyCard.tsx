import type { DeadAnomaly } from './types'
import { Reveal } from '@/components/ui/Reveal'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const ACCENT = 'var(--apple-accent)'

const CATEGORY_LABEL: Record<DeadAnomaly['category'], string> = {
  classical: 'Classical',
  event: 'Event-driven',
  information: 'Information',
  derivative: 'Derivative',
  'on-chain': 'On-chain',
}

export function AnomalyCard({
  anomaly,
  delay = 0,
}: {
  anomaly: DeadAnomaly
  delay?: number
}) {
  const lifespan = anomaly.died.year - anomaly.born.year

  return (
    <Reveal delay={delay}>
      <a
        href={anomaly.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${anomaly.name}. Source ${anomaly.sourceLabel}`}
        className="acf-card flex flex-col h-full no-underline"
        style={{
          background: 'var(--apple-panel)',
          border: '1px solid var(--apple-line)',
          borderRadius: 'var(--apple-r-md)',
          padding: 20,
          gap: 14,
          color: TEXT,
          textDecoration: 'none',
          transition:
            'transform 280ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 280ms cubic-bezier(0.32, 0.72, 0, 1), border-color 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <header className="flex items-baseline justify-between gap-3">
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '+0.04em',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {CATEGORY_LABEL[anomaly.category]}
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.011em',
              color: TERTIARY,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {anomaly.born.year} – {anomaly.died.year}
          </span>
        </header>

        <h3
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            lineHeight: 1.21,
            color: TEXT,
          }}
        >
          {anomaly.name}
        </h3>

        {/* Peak vs current return — the magnitude of collapse */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'baseline',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.022em',
              color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {fmtPeak(anomaly.peakReturn)}
            <span
              style={{
                fontSize: 14,
                color: TERTIARY,
                fontWeight: 400,
                marginLeft: 4,
              }}
            >
              →
            </span>{' '}
            <span style={{ color: TEXT }}>{fmtCurrent(anomaly.currentReturn)}</span>
          </div>
        </div>

        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            lineHeight: 1.45,
            letterSpacing: '-0.011em',
            color: TEXT,
            fontWeight: 500,
          }}
        >
          {anomaly.what}
        </p>

        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            lineHeight: 1.45,
            letterSpacing: '-0.011em',
            color: SECONDARY,
            fontStyle: 'italic',
          }}
        >
          {anomaly.knife}
        </p>

        <footer
          className="flex items-center justify-between gap-3 mt-auto pt-3"
          style={{ borderTop: '1px solid var(--apple-line)' }}
        >
          <span
            className="acf-card-source"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              fontWeight: 500,
              color: ACCENT,
              letterSpacing: '-0.005em',
            }}
          >
            {anomaly.sourceLabel} <span className="acf-card-arrow">›</span>
          </span>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {lifespan} yr lifespan
          </span>
        </footer>
      </a>
    </Reveal>
  )
}

function fmtPeak(v: number): string {
  if (v === 0) return '0%/yr'
  if (Math.abs(v) >= 100) return `${v.toFixed(0)}%/yr`
  if (Math.abs(v) >= 10) return `${v.toFixed(1).replace(/\.0$/, '')}%/yr`
  return `${v.toFixed(1)}%/yr`
}

function fmtCurrent(v: number): string {
  if (v === 0) return '~0'
  const sign = v > 0 ? '+' : ''
  if (Math.abs(v) >= 100) return `${sign}${v.toFixed(0)}%`
  if (Math.abs(v) >= 10) return `${sign}${v.toFixed(1).replace(/\.0$/, '')}%`
  return `${sign}${v.toFixed(1)}%`
}
