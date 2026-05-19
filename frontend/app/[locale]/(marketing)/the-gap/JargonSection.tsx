import { Reveal } from '@/components/ui/Reveal'
import { JARGON } from './data-jargon'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const ACCENT = 'var(--apple-accent)'
const LINE = 'var(--apple-line)'

export function JargonSection() {
  return (
    <section
      id="jargon"
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
            The industry has a vocabulary for the user it cannot get back.
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
            Churned. Resurrected. Forfeiture. Erosion. Vintage concentration.
            Pretty consistent. Less value to us. The cohort has a name in every
            filing. It changes by company. The thing it names is the same.
          </p>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {JARGON.map((entry, i) => (
          <Reveal key={entry.slug} delay={Math.min(i * 0.04, 0.24)}>
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${entry.company} — ${entry.term}. Source: ${entry.sourceLabel}`}
              className="tg-card no-underline"
              style={{
                color: TEXT,
                textDecoration: 'none',
              }}
            >
              <header
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
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
                  {entry.company}
                </span>
              </header>

              <h3
                style={{
                  fontFamily: 'var(--apple-font-display)',
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: '-0.022em',
                  lineHeight: 1.18,
                  color: ACCENT,
                }}
              >
                {entry.term}
              </h3>

              <blockquote
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  letterSpacing: '-0.011em',
                  color: TEXT,
                  fontWeight: 500,
                  margin: 0,
                  paddingLeft: 12,
                  borderLeft: `2px solid ${LINE}`,
                }}
              >
                {entry.quote}
              </blockquote>

              <p
                style={{
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  letterSpacing: '-0.011em',
                  color: SECONDARY,
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                {entry.knife}
              </p>

              <footer
                style={{
                  marginTop: 'auto',
                  paddingTop: 12,
                  borderTop: `1px solid ${LINE}`,
                  fontFamily: 'var(--apple-font-text)',
                  fontSize: 12,
                  color: ACCENT,
                  letterSpacing: '-0.005em',
                  fontWeight: 500,
                }}
              >
                {entry.sourceLabel}{' '}
                <span className="tg-card-arrow">›</span>
              </footer>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
