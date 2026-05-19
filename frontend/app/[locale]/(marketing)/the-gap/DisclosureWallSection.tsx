import { Reveal } from '@/components/ui/Reveal'
import { DISCLOSURES } from './data-disclosures'
import type { DisclosureRow } from './types'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'

const KIND_LABEL: Record<DisclosureRow['kind'], string> = {
  regulator: 'Regulator-mandated',
  academic: 'Peer-reviewed',
  'on-chain': 'On-chain audit',
  industry: 'Industry disclosure',
}

export function DisclosureWallSection() {
  return (
    <section
      id="disclosures"
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
            Every product the cohort tried prints its own loss rate.
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
            CFDs. Forex. Options. Day-traded equities. Perpetuals. Memecoins.
            Wallet drainers. The product changes; the math is constant. Sixty to
            ninety-seven percent of retail loses money. The regulator forces some
            of them to print it on the homepage. The academics printed the
            rest. The user reads it three times before they stop.
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
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1.6fr 1.2fr 2fr 0.7fr',
              padding: '14px',
              background: 'var(--apple-surface)',
              borderBottom: `1px solid ${LINE}`,
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              color: TERTIARY,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
            className="tg-disclosure-header"
          >
            <span>Product</span>
            <span>Source</span>
            <span>Loss rate</span>
            <span>Sample</span>
            <span style={{ textAlign: 'right' }}>Year</span>
          </div>

          <div className="tg-disclosure-table">
            {DISCLOSURES.map((row) => (
              <DisclosureCells key={row.slug} row={row} />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function DisclosureCells({ row }: { row: DisclosureRow }) {
  return (
    <div className="tg-disclosure-row">
      <div className="tg-disclosure-cell" style={{ fontWeight: 600 }}>
        <span className="tg-cell-label">Product</span>
        {row.product}
      </div>
      <div className="tg-disclosure-cell tg-cohort-cell-secondary">
        <span className="tg-cell-label">Source</span>
        <a
          href={row.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--apple-text)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {row.source}
        </a>
        <span className="tg-disclosure-kind">{KIND_LABEL[row.kind]}</span>
      </div>
      <div className="tg-disclosure-cell tg-disclosure-loss">
        <span className="tg-cell-label">Loss rate</span>
        {row.lossRate}
      </div>
      <div
        className="tg-disclosure-cell tg-cohort-cell-secondary"
        style={{ fontSize: 13 }}
      >
        <span className="tg-cell-label">Sample</span>
        {row.sample}
      </div>
      <div
        className="tg-disclosure-cell"
        style={{ textAlign: 'right', fontSize: 12, color: TERTIARY }}
      >
        <span className="tg-cell-label">Year</span>
        {row.year}
      </div>
    </div>
  )
}
