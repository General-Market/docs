import { Reveal } from '@/components/ui/Reveal'
import { ALPHAS_ALIVE_BY_YEAR, DEAD_ANOMALIES } from './data-anomalies'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'
const ACCENT = 'var(--apple-accent)'
const SURFACE = 'var(--apple-surface)'

const FIRST_YEAR = ALPHAS_ALIVE_BY_YEAR[0].year
const LAST_YEAR = ALPHAS_ALIVE_BY_YEAR[ALPHAS_ALIVE_BY_YEAR.length - 1].year
const MAX_ALIVE = Math.max(...ALPHAS_ALIVE_BY_YEAR.map(p => p.alive))

// Year-of-death lookup so the bar shows a marker the year the alpha dies.
const DEATHS_BY_YEAR = new Map<number, string[]>()
DEAD_ANOMALIES.forEach(a => {
  const list = DEATHS_BY_YEAR.get(a.died.year) ?? []
  list.push(a.name)
  DEATHS_BY_YEAR.set(a.died.year, list)
})

export function GraveyardTimelineSection() {
  return (
    <section
      id="graveyard-timeline"
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
                Fourteen retail alphas, year by year
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
                Each bar shows how many retail-accessible alphas were still measurably profitable
                after costs that year. The dots mark the year a specific anomaly was killed —
                either by a paper proving the decay or by a structural change that ate the spread.
              </p>
              <div
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                {FIRST_YEAR} → {LAST_YEAR}. From {MAX_ALIVE} to 1.
              </div>
            </div>

            <div className="ash-timeline-wrap">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ALPHAS_ALIVE_BY_YEAR.map((point, i) => {
                  const pct = (point.alive / MAX_ALIVE) * 100
                  const dyingThisYear = DEATHS_BY_YEAR.get(point.year) ?? []
                  const isMajorMilestone =
                    point.year === FIRST_YEAR ||
                    point.year === LAST_YEAR ||
                    point.year % 5 === 0
                  return (
                    <YearRow
                      key={point.year}
                      year={point.year}
                      alive={point.alive}
                      pct={pct}
                      killed={point.killed}
                      dyingThisYear={dyingThisYear}
                      isMajorMilestone={isMajorMilestone}
                      delay={i * 0.012}
                    />
                  )
                })}
              </div>

              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: `1px solid ${LINE}`,
                  display: 'flex',
                  gap: 18,
                  flexWrap: 'wrap',
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 11,
                  color: TERTIARY,
                  letterSpacing: '-0.005em',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: ACCENT,
                      opacity: 0.32,
                      display: 'inline-block',
                    }}
                  />
                  Still tradeable
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: ACCENT,
                      display: 'inline-block',
                    }}
                  />
                  Killed this year
                </span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function YearRow({
  year,
  alive,
  pct,
  killed,
  dyingThisYear,
  isMajorMilestone,
  delay,
}: {
  year: number
  alive: number
  pct: number
  killed?: string
  dyingThisYear: string[]
  isMajorMilestone: boolean
  delay: number
}) {
  return (
    <Reveal delay={delay} y={6}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '64px 1fr 38px',
          alignItems: 'center',
          gap: 12,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 12,
            fontWeight: isMajorMilestone ? 600 : 400,
            color: isMajorMilestone ? TEXT : TERTIARY,
            letterSpacing: '-0.005em',
          }}
        >
          {year}
        </div>

        <div
          style={{
            position: 'relative',
            height: 16,
            background: SURFACE,
            borderRadius: 3,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: `${pct}%`,
              background: ACCENT,
              opacity: 0.32,
              borderRadius: 3,
            }}
          />
          {dyingThisYear.length > 0 && (
            <div
              title={dyingThisYear.join(' · ')}
              style={{
                position: 'absolute',
                top: '50%',
                left: `calc(${pct}% - 5px)`,
                transform: 'translateY(-50%)',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: ACCENT,
                boxShadow: '0 0 0 2px var(--apple-panel)',
              }}
            />
          )}
          {killed && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: `calc(${pct}% + 14px)`,
                transform: 'translateY(-50%)',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 11,
                color: SECONDARY,
                letterSpacing: '-0.005em',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 360,
                fontStyle: 'italic',
              }}
            >
              {killed}
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: 'right',
            fontFamily: 'var(--apple-font-display)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 13,
            fontWeight: 600,
            color: alive <= 2 ? ACCENT : TEXT,
            letterSpacing: '-0.011em',
          }}
        >
          {alive}
        </div>
      </div>
    </Reveal>
  )
}
