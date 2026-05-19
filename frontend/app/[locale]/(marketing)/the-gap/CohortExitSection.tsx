import { Reveal } from '@/components/ui/Reveal'
import { COHORTS } from './data-cohorts'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'

export function CohortExitSection() {
  return (
    <section
      id="cohort-exit"
      style={{
        paddingTop: 80,
        paddingBottom: 24,
        borderTop: `1px solid ${LINE}`,
        scrollMarginTop: 80,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <Reveal mask>
          <h2
            className="font-semibold"
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'clamp(28px, 3.6vw, 40px)',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tighter)',
              lineHeight: 1.1,
              color: TEXT,
            }}
          >
            Every retail venue tracks two numbers.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
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
            The first is everyone who ever showed up. The second is who is still
            here. The gap between them is, by accounting construction, monotonic.
            It only grows. Each public-listed broker and casino reports it.
            Several have stopped publishing the cumulative number; the silence
            is the disclosure.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.14}>
        <div
          style={{
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
            overflow: 'hidden',
          }}
        >
          {/* Desktop header */}
          <div
            className="tg-cohort-header"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 2.4fr 1fr 1fr 1fr 1.2fr',
              padding: '14px 14px',
              background: 'var(--apple-surface)',
              borderBottom: `1px solid ${LINE}`,
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              color: TERTIARY,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <span>Company</span>
            <span>The metric they print</span>
            <span style={{ textAlign: 'right' }}>Cumulative</span>
            <span style={{ textAlign: 'right' }}>Active</span>
            <span style={{ textAlign: 'right' }}>The gap</span>
            <span style={{ textAlign: 'right' }}>Source</span>
          </div>

          <div className="tg-cohort-table">
            {COHORTS.map((row) => (
              <CohortRow key={row.slug} row={row} />
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.22}>
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginTop: 14,
            lineHeight: 1.55,
          }}
        >
          * Coinbase stopped publishing Verified Users in 2023 when the
          active-to-verified ratio fell below 9%. The metric was retired.
          The truth was not.
        </p>
      </Reveal>
    </section>
  )
}

function CohortRow({ row }: { row: (typeof COHORTS)[number] }) {
  return (
    <>
      <div className="tg-cohort-row">
        <div className="tg-cohort-cell">
          <div className="tg-cohort-cell-company">{row.company}</div>
          <div className="tg-cohort-cell-ticker">{row.ticker}</div>
        </div>
        <div className="tg-cohort-cell tg-cohort-cell-secondary">{row.kpi}</div>
        <div
          className="tg-cohort-cell tg-cohort-cell-numeric"
          style={{ textAlign: 'right' }}
        >
          <span className="tg-cell-label">Cumulative</span>
          <span className={row.obfuscated ? 'tg-cohort-cell-obfuscated' : ''}>
            {row.cumulative}
          </span>
        </div>
        <div
          className="tg-cohort-cell tg-cohort-cell-numeric"
          style={{ textAlign: 'right' }}
        >
          <span className="tg-cell-label">Active</span>
          {row.active}
        </div>
        <div
          className="tg-cohort-cell tg-cohort-cell-numeric tg-cohort-cell-gap"
          style={{ textAlign: 'right' }}
        >
          <span className="tg-cell-label">Gap</span>
          {row.gap}
        </div>
        <div
          className="tg-cohort-cell"
          style={{ textAlign: 'right', fontSize: 12 }}
        >
          <span className="tg-cell-label">Source</span>
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--apple-accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            {row.sourceLabel} ›
          </a>
        </div>
        <div className="tg-cohort-growth">{row.growth}</div>
      </div>
    </>
  )
}
