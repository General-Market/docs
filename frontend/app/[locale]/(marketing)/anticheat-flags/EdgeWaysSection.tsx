import { Reveal } from '@/components/ui/Reveal'
import { EDGE_WAYS } from './data-edge-ways'

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
            fontWeight: 600,
            color: TERTIARY,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          14 mechanisms · {total} bps stacked
        </div>
      </Reveal>

      <Reveal mask delay={0.04}>
        <h2
          className="font-semibold"
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 'clamp(32px, 4.2vw, 48px)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tighter)',
            lineHeight: 1.0833,
            color: TEXT,
            maxWidth: 820,
          }}
        >
          Fourteen ways the venue takes a bite. Each named, each weighed.
        </h2>
      </Reveal>

      <Reveal delay={0.1}>
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 19,
            lineHeight: 1.42,
            letterSpacing: 'var(--apple-track-tight)',
            color: SECONDARY,
            marginTop: 16,
            maxWidth: 734,
          }}
        >
          One bar per mechanism. Width is basis points the maxed-out market maker books over retail
          per round-trip, amortized by how often it actually fires. Rare-but-massive events are not
          pretended to fire every trade.
        </p>
      </Reveal>

      {/* Horizontal bar chart */}
      <Reveal delay={0.2}>
        <figure
          role="img"
          aria-label="Fourteen mechanisms ranked by basis-point cost per round-trip trade"
          style={{ marginTop: 36, marginBottom: 0 }}
        >
          <div
            style={{
              padding: '28px 28px 20px',
              background: 'var(--apple-panel)',
              border: `1px solid ${LINE}`,
              borderRadius: 'var(--apple-r-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 12,
                fontWeight: 600,
                color: TERTIARY,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Per-trade cost · bps, frequency-adjusted
            </div>

            {EDGE_WAYS.map(w => {
              const pct = (w.bps / max) * 100
              return (
                <a
                  key={w.slug}
                  href={`#way-${w.slug}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(190px, 220px) 1fr minmax(80px, 96px)',
                    columnGap: 18,
                    alignItems: 'center',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
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
                      {pad2(w.rank)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--apple-font-text)',
                        fontSize: 14,
                        color: TEXT,
                        fontWeight: 600,
                        letterSpacing: '-0.016em',
                        lineHeight: 1.3,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {w.name}
                    </span>
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      height: 22,
                      background: SURFACE,
                      borderRadius: 'var(--apple-r-pill)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${Math.max(0.5, pct)}%`,
                        background: `linear-gradient(90deg, ${ACCENT}, #2997FF)`,
                        borderRadius: 'var(--apple-r-pill)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--apple-font-display)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: 'var(--apple-track-tighter)',
                      color: ACCENT,
                    }}
                  >
                    {fmtBps(w.bps)}
                  </div>
                </a>
              )
            })}

            {/* Axis */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(190px, 220px) 1fr minmax(80px, 96px)',
                columnGap: 18,
                marginTop: 6,
              }}
            >
              <div />
              <div style={{ position: 'relative', height: 16 }}>
                {[0, 0.25, 0.5, 1].map((t, i) => (
                  <span
                    key={t}
                    style={{
                      position: 'absolute',
                      left: `${t * 100}%`,
                      transform:
                        i === 0
                          ? 'translateX(0)'
                          : i === 3
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 11,
                      color: TERTIARY,
                      letterSpacing: '+0.011em',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmtBps(max * t)}
                  </span>
                ))}
              </div>
              <div />
            </div>
          </div>
          <figcaption
            style={{
              marginTop: 14,
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '+0.011em',
              textAlign: 'right',
            }}
          >
            Frequency-adjusted · retail baseline = 0
          </figcaption>
        </figure>
      </Reveal>

      {/* Methodology — demoted from a hero card to a quiet collapsible */}
      <Reveal delay={0.24}>
        <details
          style={{
            marginTop: 20,
            maxWidth: 734,
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            lineHeight: 1.55,
            color: SECONDARY,
            letterSpacing: '-0.011em',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              color: TEXT,
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '-0.011em',
            }}
          >
            How each mechanism becomes bps
          </summary>
          <p style={{ marginTop: 8 }}>
            Peak bps from a fee schedule, a latency conversion (ms × 0.05 bps/ms,
            Aquilina–Budish–O&rsquo;Neill 2020), or a sourced adverse-selection study. Frequency is
            the probability the mechanism fires on a single retail round-trip at a venue where it
            is active. Per-trade bps = peak × frequency. Per-venue total = sum across active
            mechanisms. That is all the math.
          </p>
        </details>
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
                  {fmtBps(w.bps)}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--apple-font-text)',
                    fontSize: 12,
                    color: TERTIARY,
                    letterSpacing: '-0.005em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  peak {w.peakBps} bps · fires {(w.frequency * 100).toFixed(w.frequency < 0.01 ? 2 : 0)}% of trades
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
                {w.conversion} {w.frequencyNote}{' '}
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
