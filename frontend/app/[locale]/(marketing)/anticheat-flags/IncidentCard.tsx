import type { Incident } from './types'
import { Diagram } from './charts/Diagram'
import { Reveal } from '@/components/ui/Reveal'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'

export function IncidentCard({ incident, delay = 0 }: { incident: Incident; delay?: number }) {
  const tone = incident.amountTone ?? 'loss'
  const amountColor =
    tone === 'loss' ? 'var(--apple-accent)' :
    tone === 'muted' ? TERTIARY :
    tone === 'alleged' ? SECONDARY :
    TEXT

  return (
    <Reveal delay={delay}>
      <article
        className="flex flex-col h-full"
        style={{
          background: 'var(--apple-panel)',
          border: '1px solid var(--apple-line)',
          borderRadius: 'var(--apple-r-md)',
          padding: 20,
          gap: 14,
        }}
      >
        <header className="flex items-baseline justify-between gap-3">
          <time
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {incident.date}
          </time>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.016em',
              color: amountColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {incident.amount}
          </span>
        </header>

        <h3
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            lineHeight: 1.21,
            color: TEXT,
          }}
        >
          {incident.headline}
        </h3>

        <Diagram mechanism={incident.mechanism} {...incident.chart} />

        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 15,
            lineHeight: 1.4,
            letterSpacing: '-0.016em',
            color: TEXT,
            fontWeight: 500,
          }}
        >
          {incident.knife}
        </p>

        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            lineHeight: 1.45,
            letterSpacing: '-0.011em',
            color: SECONDARY,
          }}
        >
          {incident.summary}
        </p>

        <footer
          className="flex items-center justify-between gap-3 mt-auto pt-3"
          style={{ borderTop: '1px solid var(--apple-line)' }}
        >
          <a
            href={incident.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--apple-accent)',
              letterSpacing: '-0.005em',
            }}
            className="hover:underline"
          >
            {incident.sourceLabel} ›
          </a>
          {incident.tag && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 'var(--apple-r-pill)',
                background: 'var(--apple-surface)',
                color: TERTIARY,
                fontFamily: 'var(--apple-font-text)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {incident.tag}
            </span>
          )}
        </footer>
      </article>
    </Reveal>
  )
}
