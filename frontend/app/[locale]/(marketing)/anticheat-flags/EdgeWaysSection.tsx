import { Reveal } from '@/components/ui/Reveal'
import { EDGE_WAYS } from './data-edge-ways'
import { InlineObjection } from './InlineObjection'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

function fmtBps(bps: number): string {
  if (bps >= 10) return `${bps.toFixed(0)} bps`
  if (bps >= 1) return `${bps.toFixed(1).replace(/\.0$/, '')} bps`
  if (bps >= 0.01) return `${bps.toFixed(2)} bps`
  return `${bps.toFixed(3)} bps`
}

export function EdgeWaysSection() {
  const max = Math.max(...EDGE_WAYS.map(w => w.bps))
  const total = +EDGE_WAYS.reduce((acc, w) => acc + w.bps, 0).toFixed(2)

  return (
    <section
      id="edge-ways"
      style={{
        paddingTop: 80,
        paddingBottom: 24,
        borderTop: `1px solid ${LINE}`,
        scrollMarginTop: 80,
      }}
    >
      <Reveal delay={0.04}>
        <div
          className="acf-chart-panel"
          style={{
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
          }}
        >
          <div className="acf-chart-grid">
            <div>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Mechanisms · {EDGE_WAYS.length} sourced · bps
              </div>
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
                Thirteen ways the venue takes a bite
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
                Bar = effective bps per round-trip = peak bps × frequency. Solid inner = how reliably the mechanism fires (full bar = every trade, sliver = tail event). Faded extension = the rest. Retail baseline = 0.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                {total} bps if a single venue runs every play
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {EDGE_WAYS.map(w => {
                const lightPct = Math.max(1, (w.bps / max) * 100)
                const darkPct = Math.max(0.5, lightPct * w.frequency)
                return (
                  <MechanismRow
                    key={w.slug}
                    rank={w.rank}
                    name={w.name}
                    slug={w.slug}
                    lightPct={lightPct}
                    darkPct={darkPct}
                    bps={w.bps}
                    peakBps={w.peakBps}
                    frequency={w.frequency}
                  />
                )
              })}
              <GeneralBaselineRow />
            </div>
          </div>

          {/* Source footer cards */}
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
            {EDGE_WAYS.map(w => (
              <div
                key={w.slug}
                id={`way-${w.slug}`}
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
                  {pad2(w.rank)} · {w.name}{' '}
                  <span style={{ color: TERTIARY, fontWeight: 400 }}>
                    · {fmtBps(w.bps)}{' '}
                    <span style={{ opacity: 0.7 }}>
                      · peak {w.peakBps} bps · fires {(w.frequency * 100).toFixed(w.frequency < 0.01 ? 2 : 0)}%
                    </span>
                  </span>
                </div>
                <div style={{ marginBottom: 4, fontStyle: 'italic', color: SECONDARY }}>
                  {w.conversion} {w.frequencyNote}
                </div>
                <div style={{ marginBottom: 4, color: SECONDARY, fontStyle: 'italic' }}>
                  Fix: {w.fix}
                </div>
                <a
                  href={w.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: ACCENT, fontSize: 11, fontWeight: 500 }}
                  className="hover:underline"
                >
                  {w.sourceLabel} ›
                </a>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <InlineObjection
        shot="Retail loses regardless. Edge or no edge."
        reply="Often, yes. The question this page tries to answer is whether retail loses to roughly two hundred basis points of structural extraction — PFOF, tiered fees, colocation tax, listing leaks, sandwich attacks — or to their own trading decisions. We measure the structural floor. What a trader does on top of that floor is their own choice, and their own responsibility."
      />
    </section>
  )
}

function MechanismRow({
  rank,
  name,
  slug,
  lightPct,
  darkPct,
  bps,
  peakBps,
  frequency,
}: {
  rank: number
  name: string
  slug: string
  lightPct: number
  darkPct: number
  bps: number
  peakBps: number
  frequency: number
}) {
  return (
    <a
      href={`#way-${slug}`}
      className="acf-bar-row"
      style={{
        textDecoration: 'none',
      }}
    >
      <div
        className="acf-bar-label"
        style={{
          flex: '0 0 160px',
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
          {pad2(rank)}
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
          {name}
        </span>
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
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${lightPct}%`,
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
            width: `${darkPct}%`,
            background: ACCENT,
            borderRadius: 4,
          }}
        />
      </div>
      <div
        className="acf-bar-value"
        style={{
          flex: '0 0 120px',
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
            color: ACCENT,
          }}
        >
          {fmtBps(bps)}
        </div>
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.005em',
            fontSize: 12,
            color: TERTIARY,
            marginTop: 2,
          }}
        >
          peak {peakBps} · {(frequency * 100).toFixed(frequency < 0.01 ? 2 : 0)}%
        </div>
      </div>
    </a>
  )
}

function GeneralBaselineRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="acf-bar-row">
        <div
          className="acf-bar-label"
          style={{
            flex: '0 0 160px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: TEXT,
            letterSpacing: '-0.011em',
            fontWeight: 600,
            paddingLeft: 30,
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
            flex: '0 0 120px',
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
          paddingLeft: 172,
          fontFamily: 'var(--apple-font-text)',
          fontSize: 12,
          color: SECONDARY,
          letterSpacing: '-0.005em',
          lineHeight: 1.45,
          fontStyle: 'italic',
        }}
      >
        Sealed bets, parimutuel, BLS-verified oracles. None of the thirteen mechanisms can fire.
      </div>
    </div>
  )
}
