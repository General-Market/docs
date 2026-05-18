import { Reveal } from '@/components/ui/Reveal'
import {
  EDGE_TOPICS,
  CATEGORY_LABEL,
  type EdgeCategory,
  type EdgeTopic,
  type CompanyRow,
} from './data-edge-matrix'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

const CATEGORY_ORDER: EdgeCategory[] = ['information', 'latency', 'execution', 'subsidy', 'risk']

function formatNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs === 0) return '0'
  if (abs < 1) return value.toLocaleString('en-US', { maximumFractionDigits: 3 })
  if (abs < 10) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function MechanismPill({ tag }: { tag: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--apple-r-pill)',
        background: SURFACE,
        color: TERTIARY,
        fontFamily: 'var(--apple-font-text)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {tag}
    </span>
  )
}

function CompanyBar({ row, max, unit }: { row: CompanyRow; max: number; unit: string }) {
  const pct = max === 0 ? 0 : Math.max((row.value / max) * 100, row.value > 0 ? 1.5 : 0)
  const gatedPct = row.value === 0 ? 0 : Math.min((row.gatedValue / row.value) * 100, 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          flex: '0 0 240px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
        }}
      >
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
          }}
        >
          {row.name}
        </span>
        <MechanismPill tag={row.tag} />
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
        {pct > 0 && (
          <>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${pct}%`,
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
                width: `${pct * (gatedPct / 100)}%`,
                background: ACCENT,
                borderRadius: 4,
              }}
            />
          </>
        )}
      </div>
      <div
        style={{
          flex: '0 0 132px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          lineHeight: 1.05,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: ACCENT }}>
          {formatNumber(row.value)} {unit.split(' ')[0]}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: TERTIARY,
            marginTop: 2,
            fontFamily: 'var(--apple-font-text)',
            letterSpacing: '-0.005em',
          }}
        >
          {formatNumber(row.gatedValue)} gated
        </div>
      </div>
    </div>
  )
}

function GeneralMarketRow({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          flex: '0 0 240px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 600,
          }}
        >
          General Market
        </span>
      </div>
      <div
        style={{
          flex: 1,
          height: 14,
          background: SURFACE,
          borderRadius: 4,
        }}
      />
      <div
        style={{
          flex: '0 0 132px',
          textAlign: 'right',
          fontFamily: 'var(--apple-font-display)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.016em',
          lineHeight: 1.05,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: TERTIARY }}>0</div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: TERTIARY,
            marginTop: 2,
            fontFamily: 'var(--apple-font-text)',
            letterSpacing: '-0.005em',
            maxWidth: 140,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={label}
        >
          {label}
        </div>
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
        style={{
          marginTop: 32,
          padding: '32px 28px',
          background: 'var(--apple-panel)',
          border: `1px solid ${LINE}`,
          borderRadius: 'var(--apple-r-md)',
          scrollMarginTop: 80,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: TERTIARY,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          {CATEGORY_LABEL[topic.category]} · {topic.rows.length} {topic.rows.length === 1 ? 'venue' : 'venues'} · unit {topic.unit}
        </div>
        <h3
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: TEXT,
            marginBottom: 8,
            maxWidth: 820,
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
            marginBottom: 24,
            maxWidth: 760,
          }}
        >
          {topic.lead}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sorted.map(row => (
            <CompanyBar key={row.slug} row={row} max={max} unit={topic.unit} />
          ))}
          <GeneralMarketRow label={topic.generalMarketLabel} />
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
            <div
              key={row.slug}
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
                  fontWeight: 500,
                  marginBottom: 3,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.name} ·{' '}
                <span style={{ color: ACCENT }}>
                  {formatNumber(row.value)} {topic.unit.split(' ')[0]}
                </span>{' '}
                ·{' '}
                <span style={{ color: TERTIARY }}>
                  {formatNumber(row.gatedValue)} gated
                </span>
              </div>
              <div style={{ marginBottom: 4 }}>{row.lane}</div>
              <div style={{ marginBottom: 6, color: SECONDARY, fontStyle: 'italic' }}>
                Barrier: {row.barrier}
              </div>
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
          ))}
        </div>
      </div>
    </Reveal>
  )
}

function CategoryDivider({ cat, count }: { cat: EdgeCategory; count: number }) {
  return (
    <Reveal>
      <div
        style={{
          marginTop: 64,
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            color: TERTIARY,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          {CATEGORY_LABEL[cat]} · {count} edge{count === 1 ? '' : 's'}
        </div>
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
          Fifteen edges · {EDGE_TOPICS.reduce((acc, t) => acc + t.rows.length, 0)} named venues · every number cited
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
          Colocation is one ruler. Fees are another. Underneath sit fifteen more — the wire, the rebate pool, the matching algo, the cancel-first quote, the listing leak, the gamma map, the PFOF cheque, the API ceiling, the funding clock, the maker flip, the liquidator vault, the late block print, the mempool sandwich. Each chart names the room. Each row names the firm that lives in it.
        </p>
      </Reveal>

      {CATEGORY_ORDER.map(cat => {
        const topics = EDGE_TOPICS.filter(t => t.category === cat)
        if (topics.length === 0) return null
        return (
          <div key={cat}>
            <CategoryDivider cat={cat} count={topics.length} />
            {topics.map(topic => (
              <TopicBlock key={topic.slug} topic={topic} />
            ))}
          </div>
        )
      })}

      {/* Closing block */}
      <Reveal delay={0.12}>
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
