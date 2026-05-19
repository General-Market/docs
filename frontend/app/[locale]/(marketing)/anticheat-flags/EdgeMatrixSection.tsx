import { Reveal } from '@/components/ui/Reveal'
import {
  EDGE_TOPICS,
  type EdgeTopic,
  type CompanyRow,
} from './data-edge-matrix'
import { InlineObjection } from './InlineObjection'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

/**
 * Format a number + unit for the right-side value pill on each bar.
 * Conventions:
 *   - "$M ..." → use $X.XM / $X.XB abbreviations.
 *   - "$B ..." → use $X.XB / $X.XM abbreviations.
 *   - "× retail" → suffix "× retail".
 *   - All other units → numeric + space + first word of unit.
 * Positive non-zero values get a leading "+". Zero is left unprefixed.
 */
function formatValueWithUnit(value: number, unit: string): string {
  if (value === 0) {
    if (unit.includes('× retail')) return '1×'
    return '0'
  }

  const sign = value > 0 ? '+' : ''

  // $M units (incl. "$M / yr ...", "$M extracted", "$M insider profit", "$M / yr ...")
  if (unit.startsWith('$M')) {
    const abs = Math.abs(value)
    let body: string
    if (abs >= 1000) body = `$${(value / 1000).toFixed(1).replace(/\.0$/, '')}B`
    else if (abs >= 100) body = `$${value.toFixed(0)}M`
    else if (abs >= 10) body = `$${value.toFixed(1).replace(/\.0$/, '')}M`
    else body = `$${value.toFixed(2).replace(/0$/, '').replace(/\.$/, '')}M`
    return `${sign}${body}${unit.includes('/ yr') ? '/yr' : ''}`
  }

  // $B units (cascade-day notional)
  if (unit.startsWith('$B')) {
    const abs = Math.abs(value)
    let body: string
    if (abs >= 1) body = `$${value.toFixed(1).replace(/\.0$/, '')}B`
    else if (abs >= 0.001) body = `$${(value * 1000).toFixed(0)}M`
    else if (abs > 0) body = `$${(value * 1_000_000).toFixed(1).replace(/\.0$/, '')}k`
    else body = '0'
    return `${sign}${body}`
  }

  // × retail ratio (api-rate-ceiling)
  if (unit.includes('× retail')) {
    const abs = Math.abs(value)
    const body = abs >= 10 ? `${value.toFixed(0)}×` : `${value.toFixed(1).replace(/\.0$/, '')}×`
    return body
  }

  // bps / score / count / ms. Numeric + first word
  const firstWord = unit.split(' ')[0]
  const abs = Math.abs(value)
  let num: string
  if (abs >= 100) num = value.toFixed(0)
  else if (abs >= 10) num = value.toFixed(0)
  else if (abs >= 1) num = value.toFixed(1).replace(/\.0$/, '')
  else num = value.toFixed(2).replace(/0$/, '').replace(/\.$/, '')
  return `${sign}${num} ${firstWord}`
}

function BarRow({
  row,
  max,
  unit,
}: {
  row: CompanyRow
  max: number
  unit: string
}) {
  const pct = max === 0 ? 0 : Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)
  return (
    <div className="acf-bar-row">
      <div
        className="acf-bar-label"
        style={{
          flex: '0 0 110px',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          color: TEXT,
          letterSpacing: '-0.011em',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.name}
      </div>
      <div
        className="acf-bar-track"
        style={{
          flex: 1,
          height: 14,
          background: SURFACE,
          borderRadius: 4,
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {/* Dashed baseline at left edge. The retail 0 mark */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -3,
            bottom: -3,
            width: 0,
            borderLeft: `1px dashed color-mix(in srgb, ${TERTIARY} 50%, transparent)`,
          }}
          aria-hidden
        />
        {pct > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${pct}%`,
              background: ACCENT,
              borderRadius: 4,
            }}
          />
        )}
      </div>
      <div
        className="acf-bar-value"
        style={{
          flex: '0 0 96px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          fontSize: 14,
          fontWeight: 600,
          color: row.value > 0 ? ACCENT : TERTIARY,
          whiteSpace: 'nowrap',
        }}
      >
        {formatValueWithUnit(row.value, unit)}
      </div>
    </div>
  )
}

function GeneralMarketRow({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="acf-bar-row">
        <div
          className="acf-bar-label"
          style={{
            flex: '0 0 110px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 600,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt=""
            width={14}
            height={14}
            style={{ borderRadius: 3, flexShrink: 0 }}
          />
          General
        </div>
        <div
          className="acf-bar-track"
          style={{
            flex: 1,
            height: 14,
            background: SURFACE,
            borderRadius: 4,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: -3,
              bottom: -3,
              width: 0,
              borderLeft: `1px dashed color-mix(in srgb, ${TERTIARY} 50%, transparent)`,
            }}
            aria-hidden
          />
        </div>
        <div
          className="acf-bar-value"
          style={{
            flex: '0 0 96px',
            textAlign: 'right',
            fontFamily: 'var(--apple-font-display)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.016em',
            fontSize: 14,
            fontWeight: 600,
            color: TERTIARY,
            whiteSpace: 'nowrap',
          }}
        >
          0
        </div>
      </div>
      <div
        className="acf-bar-caption"
        style={{
          paddingLeft: 122,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: SECONDARY,
          letterSpacing: '-0.005em',
          lineHeight: 1.45,
          fontStyle: 'italic',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function SourceCard({ row, unit }: { row: CompanyRow; unit: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--apple-font-text)',
        fontSize: 11,
        color: TERTIARY,
        letterSpacing: '-0.005em',
        lineHeight: 1.5,
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
          · {formatValueWithUnit(row.value, unit)}
        </span>
      </div>
      <div style={{ marginBottom: 4, fontStyle: 'italic', color: SECONDARY }}>{row.lane}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {row.sources.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: ACCENT,
              fontSize: 11,
              fontWeight: 500,
            }}
            className="hover:underline"
          >
            {s.label} ›
          </a>
        ))}
      </div>
    </div>
  )
}

function TopicBlock({ topic }: { topic: EdgeTopic }) {
  const sorted = topic.rows.slice().sort((a, b) => b.value - a.value)
  const max = Math.max(...sorted.map(r => r.value), 0.0001)
  return (
    <Reveal>
      <div
        id={topic.slug}
        className="acf-chart-panel"
        style={{
          marginTop: 32,
          background: 'var(--apple-panel)',
          border: `1px solid ${LINE}`,
          borderRadius: 'var(--apple-r-md)',
          scrollMarginTop: 80,
        }}
      >
        <div className="acf-chart-grid">
          <div>
            <h3
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: 'var(--apple-track-tight)',
                color: TEXT,
                marginBottom: 10,
              }}
            >
              {topic.heading}
            </h3>
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
              {topic.lead}
            </p>
            <div
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 11,
                color: TERTIARY,
                letterSpacing: '-0.005em',
              }}
            >
              {topic.rows.reduce((acc, r) => acc + r.sources.length, 0)} sourced
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sorted.map(row => (
              <BarRow key={row.slug} row={row} max={max} unit={topic.unit} />
            ))}
            <GeneralMarketRow label={topic.generalMarketLabel} />
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: `1px solid ${LINE}`,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '14px 22px',
          }}
        >
          {sorted.map(row => (
            <SourceCard key={row.slug} row={row} unit={topic.unit} />
          ))}
        </div>

        {topic.slug === 'matching-algo' && (
          <InlineObjection
            shot="Binance is pure FIFO. So is Hyperliquid. Queue-jumping is fiction."
            reply='The book is FIFO, but Binance publishes a feature called "Order Amend Keep Priority" that lets a maker shrink an order without losing its place in the queue. Deribit ships the same feature, and Hyperliquid sequences cancels before takers, which is a different mechanism in the same family. Strict FIFO with privileged edit rights stops being strict FIFO for the desks that know how to use the edits.'
            marginTop={28}
          />
        )}
      </div>
    </Reveal>
  )
}

export function EdgeMatrixSection() {
  return (
    <section
      id="edge-matrix"
      style={{
        paddingTop: 80,
        paddingBottom: 24,
        borderTop: `1px solid ${LINE}`,
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
          {EDGE_TOPICS.length} edges · {EDGE_TOPICS.reduce((acc, t) => acc + t.rows.length, 0)} named venues · every number cited
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
            maxWidth: 920,
          }}
        >
          Every Edge They Sell to Insiders.
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
          One ruler per chart. Retail sits at zero. Implied, not drawn. The blue bar is what the maxed-out market maker books over you at the same venue. Each chart names the room. Each row names the firm that lives in it.
        </p>
      </Reveal>

      {EDGE_TOPICS.map(topic => (
        <TopicBlock key={topic.slug} topic={topic} />
      ))}
    </section>
  )
}
