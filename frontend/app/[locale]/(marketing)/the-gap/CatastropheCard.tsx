import type { Catastrophe } from './types'
import { Reveal } from '@/components/ui/Reveal'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const ACCENT = 'var(--apple-accent)'

const TAG_LABEL: Record<string, string> = {
  presidential: 'Presidential',
  celebrity: 'Celebrity',
  exchange: 'Exchange',
  lender: 'Lender',
  defi: 'DeFi',
  rug: 'Rug',
  'self-custody': 'Self-custody',
  ponzi: 'Ponzi',
  broker: 'Broker',
  fund: 'Fund',
  stablecoin: 'Stablecoin',
  casino: 'Casino',
  'industry-banned': 'Industry banned',
}

export function CatastropheCard({
  catastrophe,
  delay = 0,
}: {
  catastrophe: Catastrophe
  delay?: number
}) {
  return (
    <Reveal delay={delay}>
      <a
        href={catastrophe.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${catastrophe.name}. Source ${catastrophe.sourceLabel}`}
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
          <time
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              color: TERTIARY,
              letterSpacing: '-0.005em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {catastrophe.dateLabel}
          </time>
          <span
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.016em',
              color: ACCENT,
              fontVariantNumeric: 'tabular-nums',
              textAlign: 'right',
            }}
          >
            {catastrophe.amount}
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
          {catastrophe.name}
        </h3>

        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 13,
            color: TERTIARY,
            letterSpacing: '-0.005em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {catastrophe.victims}
        </div>

        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            lineHeight: 1.45,
            letterSpacing: '-0.011em',
            color: TEXT,
            fontWeight: 500,
            margin: 0,
          }}
        >
          {catastrophe.what}
        </p>

        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            lineHeight: 1.45,
            letterSpacing: '-0.011em',
            color: SECONDARY,
            fontStyle: 'italic',
            margin: 0,
          }}
        >
          {catastrophe.knife}
        </p>

        <footer
          className="flex items-center justify-between gap-3 mt-auto pt-3"
          style={{ borderTop: '1px solid var(--apple-line)' }}
        >
          <span
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 12,
              fontWeight: 500,
              color: ACCENT,
              letterSpacing: '-0.005em',
            }}
          >
            {catastrophe.sourceLabel}{' '}
            <span className="tg-card-arrow">›</span>
          </span>
          {catastrophe.tag && (
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
              {TAG_LABEL[catastrophe.tag] ?? catastrophe.tag}
            </span>
          )}
        </footer>
      </a>
    </Reveal>
  )
}
