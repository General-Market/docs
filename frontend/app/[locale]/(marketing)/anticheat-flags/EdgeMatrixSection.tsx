import { Reveal } from '@/components/ui/Reveal'
import {
  EDGE_MATRIX,
  CATEGORY_LABEL,
  CATEGORY_BLURB,
  type EdgeCategory,
  type EdgeMatrixEntry,
} from './data-edge-matrix'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

const CATEGORY_ORDER: EdgeCategory[] = ['information', 'latency', 'execution', 'subsidy', 'risk']

function byCategory(cat: EdgeCategory): EdgeMatrixEntry[] {
  return EDGE_MATRIX.filter(e => e.category === cat)
}

function EdgeCard({ e, delay }: { e: EdgeMatrixEntry; delay: number }) {
  return (
    <Reveal delay={delay}>
      <article
        className="flex flex-col h-full"
        style={{
          background: 'var(--apple-panel)',
          border: `1px solid ${LINE}`,
          borderRadius: 'var(--apple-r-md)',
          padding: 22,
          gap: 12,
          minHeight: 380,
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 500,
              color: TERTIARY,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {CATEGORY_LABEL[e.category]}
          </span>
          <div className="flex items-baseline justify-between gap-3">
            <h3
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.022em',
                color: TEXT,
                lineHeight: 1.2,
              }}
            >
              {e.title}
            </h3>
            <span
              style={{
                fontFamily: 'var(--apple-font-display)',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.016em',
                color: ACCENT,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                textAlign: 'right',
              }}
            >
              {formatMagnitude(e.magnitudeValue, e.magnitudeUnit)}
            </span>
          </div>
        </header>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: TERTIARY,
            letterSpacing: '-0.005em',
          }}
        >
          {e.domain}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              lineHeight: 1.5,
              color: TEXT,
              fontWeight: 500,
              letterSpacing: '-0.011em',
            }}
          >
            <span style={{ color: TERTIARY, fontWeight: 400 }}>Retail · </span>
            {e.retailLine}
          </div>
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 13,
              lineHeight: 1.5,
              color: TEXT,
              fontWeight: 500,
              letterSpacing: '-0.011em',
            }}
          >
            <span style={{ color: TERTIARY, fontWeight: 400 }}>Inside · </span>
            {e.insiderLine}
          </div>
        </div>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 12,
            color: SECONDARY,
            lineHeight: 1.55,
            letterSpacing: '-0.005em',
            paddingTop: 4,
          }}
        >
          <span style={{ color: TERTIARY }}>Proof · </span>
          {e.proof}
        </div>

        <footer
          className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3"
          style={{ marginTop: 'auto', borderTop: `1px solid ${LINE}` }}
        >
          {e.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 11,
                fontWeight: 500,
                color: ACCENT,
                letterSpacing: '-0.005em',
              }}
              className="hover:underline"
            >
              {s.label} ›
            </a>
          ))}
        </footer>
      </article>
    </Reveal>
  )
}

function formatMagnitude(value: number, unit: string): string {
  // Tabular formatting: keep the number compact, append the unit verbatim.
  const abs = Math.abs(value)
  let num: string
  if (Number.isInteger(value) || abs >= 100) {
    num = value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  } else {
    num = value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  return `${num} ${unit}`
}

function BarRow({
  label,
  domain,
  value,
  unit,
  pct,
  label2,
}: {
  label: string
  domain: string
  value: number
  unit: string
  pct: number
  label2: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ flex: '0 0 196px', minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            color: TEXT,
            fontWeight: 500,
            letterSpacing: '-0.011em',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {domain}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: SURFACE,
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${Math.max(pct, 1.5)}%`,
            background: ACCENT,
            borderRadius: 4,
          }}
        />
      </div>
      <div
        style={{
          flex: '0 0 132px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontSize: 15,
          fontWeight: 600,
          color: ACCENT,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          whiteSpace: 'nowrap',
        }}
      >
        {formatMagnitude(value, unit)}
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 10,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            fontWeight: 400,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label2}
        </div>
      </div>
    </div>
  )
}

function CategoryRanker({ cat }: { cat: EdgeCategory }) {
  const rows = byCategory(cat)
  if (rows.length === 0) return null
  const max = Math.max(...rows.map(r => r.magnitudeValue))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: TERTIARY,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontWeight: 500,
            marginBottom: 4,
          }}
        >
          {CATEGORY_LABEL[cat]}
        </div>
        <h4
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            color: TEXT,
          }}
        >
          {CATEGORY_BLURB[cat]}
        </h4>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows
          .slice()
          .sort((a, b) => b.magnitudeValue - a.magnitudeValue)
          .map(r => (
            <BarRow
              key={r.slug}
              label={r.title}
              domain={r.domain}
              value={r.magnitudeValue}
              unit={r.magnitudeUnit}
              pct={(r.magnitudeValue / max) * 100}
              label2={r.magnitudeLabel}
            />
          ))}
      </div>
    </div>
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
          The structural edge inventory · 15 categories · every number cited
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
            maxWidth: 880,
          }}
        >
          The Edge Retail Doesn&apos;t Have.
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
          Fees are the visible part. Underneath sit fifteen other mechanisms that decide who gets paid and who pays. Each one is published — somewhere, partially, in a regulator filing or a developer doc no retail user opens. We opened them.
        </p>
      </Reveal>

      {/* Cards — grouped by category */}
      {CATEGORY_ORDER.map((cat, ci) => {
        const rows = byCategory(cat)
        if (rows.length === 0) return null
        return (
          <div key={cat} style={{ marginTop: ci === 0 ? 48 : 56 }}>
            <Reveal>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 11,
                    color: TERTIARY,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  {CATEGORY_LABEL[cat]} — {rows.length} edge{rows.length === 1 ? '' : 's'}
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tight)',
                    color: TEXT,
                    maxWidth: 820,
                  }}
                >
                  {CATEGORY_BLURB[cat]}
                </h3>
              </div>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((e, i) => (
                <EdgeCard key={e.slug} e={e} delay={Math.min(i * 0.03, 0.18)} />
              ))}
            </div>
          </div>
        )
      })}

      {/* The five rulers — per-category bar charts */}
      <Reveal delay={0.08}>
        <div
          style={{
            marginTop: 64,
            padding: '32px 28px',
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              marginBottom: 4,
            }}
          >
            Five categories, five rulers
          </div>
          <h3
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: TEXT,
              marginBottom: 8,
            }}
          >
            The retail trader plays a different game on each.
          </h3>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 14,
              color: SECONDARY,
              lineHeight: 1.55,
              letterSpacing: '-0.011em',
              marginBottom: 32,
              maxWidth: 780,
            }}
          >
            Units do not line up across categories — microseconds, basis points, dollars extracted, percent of taker fees recycled. Each ruler is internally consistent; comparing across rulers is the point. The retail account loses on every one of them.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {CATEGORY_ORDER.map(cat => (
              <CategoryRanker key={cat} cat={cat} />
            ))}
          </div>

          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              lineHeight: 1.55,
              marginTop: 32,
              paddingTop: 20,
              borderTop: `1px solid ${LINE}`,
            }}
          >
            Bar length = canonical published magnitude for each edge, normalized within its category. Information units: dollars tipped / paid / institutional-feed price / seconds of head-start. Latency units: dollars extracted / microseconds / milliseconds / count of algorithms. Execution units: count of algorithms / percent cancelled / multiple of rate-limit gap / percent per funding cycle. Subsidy units: percent of taker fees recycled / basis points round-trip swing. Risk units: dollars liquidated in a single day / hours of trade-print delay. Comparing percent to dollars is not the trick. The trick is that each ruler has only one occupant and it is not retail.
          </div>
        </div>
      </Reveal>

      {/* The room — single closing block */}
      <Reveal delay={0.12}>
        <div
          style={{
            marginTop: 32,
            padding: '32px 28px',
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              marginBottom: 4,
            }}
          >
            What is left after the rulers
          </div>
          <h3
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: TEXT,
              marginBottom: 14,
            }}
          >
            Fifteen mechanisms. One door. None of them lead to you.
          </h3>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 15,
              color: SECONDARY,
              lineHeight: 1.6,
              letterSpacing: '-0.011em',
              maxWidth: 780,
              margin: 0,
            }}
          >
            The pre-print wire, the direct feed, the colocation cabinet, the rebate pool, the matching algo, the cancel-first quote, the listing leak, the gamma map, the PFOF cheque, the API ceiling, the funding clock, the maker flip, the liquidator vault, the late block print, the mempool sandwich. Each one is a contract someone signed. Most of the contracts are public. The signatures are not.
          </p>
          <div
            style={{
              marginTop: 24,
              padding: '20px 22px',
              background: SURFACE,
              borderRadius: 'var(--apple-r-sm)',
              borderLeft: `3px solid ${ACCENT}`,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 15,
                lineHeight: 1.6,
                letterSpacing: '-0.011em',
                color: TEXT,
                fontStyle: 'italic',
                margin: 0,
              }}
            >
              A market with no rebate pool, no private feed, no colocation cabinet, no listing leak, no auto-liquidator counterparty has nothing left to extract. There is also nothing left to sell. We chose the first thing.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
