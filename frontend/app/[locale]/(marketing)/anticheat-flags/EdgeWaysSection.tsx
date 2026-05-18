import { Reveal } from '@/components/ui/Reveal'
import { EDGE_WAYS } from './data-edge-ways'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

const CHART_HEIGHT = 280
const BAR_AREA = 240

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

export function EdgeWaysSection() {
  const max = Math.max(...EDGE_WAYS.map(w => w.bps))
  const total = EDGE_WAYS.reduce((acc, w) => acc + w.bps, 0)

  return (
    <section
      id="edge-ways"
      style={{
        paddingTop: 80,
        paddingBottom: 48,
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
          {EDGE_WAYS.length} mechanisms · {total} bps if a single venue runs every play
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
            maxWidth: 980,
          }}
        >
          14 Ways Exchanges &amp; MMs Steal Your Money — and How to Fix It.
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
          One bar per mechanism. Height is basis points the maxed-out market maker books over retail
          on a single round-trip. No variance, no turnover, no annualization. Add the bars that
          apply at a venue — that is the venue&rsquo;s edge gap.
        </p>
      </Reveal>

      {/* Methodology — the only math */}
      <Reveal delay={0.16}>
        <div
          style={{
            marginTop: 24,
            padding: '14px 18px',
            background: SURFACE,
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-sm)',
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            lineHeight: 1.55,
            color: SECONDARY,
            letterSpacing: '-0.011em',
            maxWidth: 780,
          }}
        >
          <span style={{ color: TEXT, fontWeight: 600 }}>How each mechanism becomes bps.</span>{' '}
          Fee-tier delta → published fee schedule, MM tier minus retail tier. Latency edge →
          milliseconds × 0.05 bps/ms (Aquilina–Budish–O&rsquo;Neill, 2020). Information and
          execution edges → adverse-selection bps as cited in the named study. Per-venue total =
          sum of active mechanisms. That is all the math.
        </div>
      </Reveal>

      {/* Vertical bar chart */}
      <Reveal delay={0.2}>
        <div
          role="img"
          aria-label="Fourteen mechanisms ranked by basis-point cost per round-trip trade"
          style={{
            marginTop: 36,
            padding: '24px 12px 16px',
            background: 'var(--apple-panel)',
            border: `1px solid ${LINE}`,
            borderRadius: 'var(--apple-r-md)',
            overflowX: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${EDGE_WAYS.length}, minmax(48px, 1fr))`,
              columnGap: 10,
              minWidth: EDGE_WAYS.length * 56,
              alignItems: 'end',
            }}
          >
            {EDGE_WAYS.map(w => {
              const h = Math.max(2, (w.bps / max) * BAR_AREA)
              return (
                <a
                  key={w.slug}
                  href={`#way-${w.slug}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textDecoration: 'none',
                  }}
                >
                  {/* bps label */}
                  <div
                    style={{
                      fontFamily: 'var(--apple-font-display)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: 'var(--apple-track-tighter)',
                      color: ACCENT,
                      marginBottom: 6,
                    }}
                  >
                    {w.bps}
                  </div>
                  {/* bar */}
                  <div
                    style={{
                      width: '70%',
                      height: CHART_HEIGHT - 60,
                      display: 'flex',
                      alignItems: 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: h,
                        background: ACCENT,
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                  </div>
                  {/* baseline */}
                  <div
                    style={{
                      width: '100%',
                      height: 1,
                      background: LINE,
                      marginTop: 0,
                    }}
                  />
                  {/* rank + name */}
                  <div
                    style={{
                      marginTop: 8,
                      textAlign: 'center',
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 10,
                      color: TERTIARY,
                      letterSpacing: '0.04em',
                      fontWeight: 600,
                    }}
                  >
                    {pad2(w.rank)}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      textAlign: 'center',
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 11,
                      color: TEXT,
                      letterSpacing: '-0.005em',
                      lineHeight: 1.25,
                      hyphens: 'auto',
                    }}
                  >
                    {w.name}
                  </div>
                </a>
              )
            })}
          </div>
          <div
            style={{
              marginTop: 18,
              paddingTop: 12,
              borderTop: `1px solid ${LINE}`,
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              textAlign: 'right',
            }}
          >
            bps per round-trip · retail = 0
          </div>
        </div>
      </Reveal>

      {/* Per-mechanism prose */}
      <div style={{ marginTop: 48 }}>
        {EDGE_WAYS.map((w, i) => (
          <Reveal key={w.slug} delay={Math.min(i * 0.02, 0.2)}>
            <article
              id={`way-${w.slug}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 6,
                padding: '20px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${LINE}`,
                scrollMarginTop: 80,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 11,
                    color: TERTIARY,
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {pad2(w.rank)}
                </span>
                <h3
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: '-0.022em',
                    color: TEXT,
                    lineHeight: 1.2,
                  }}
                >
                  {w.name}
                </h3>
                <span
                  style={{
                    fontFamily: 'var(--apple-font-display)',
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: 'var(--apple-track-tighter)',
                    color: ACCENT,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {w.bps} bps
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  letterSpacing: '-0.011em',
                  color: SECONDARY,
                  maxWidth: 780,
                  marginTop: 4,
                }}
              >
                {w.conversion}{' '}
                <a
                  href={w.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: ACCENT, fontWeight: 500 }}
                  className="hover:underline"
                >
                  {w.sourceLabel} ›
                </a>
              </p>
              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  letterSpacing: '-0.011em',
                  color: TEXT,
                  maxWidth: 780,
                  marginTop: 2,
                }}
              >
                <span style={{ fontWeight: 600 }}>The fix.</span> {w.fix}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
