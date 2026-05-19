'use client'

import { Link } from '@/i18n/routing'

const ARTICLES: Array<{ href: string; title: string; eyebrow: string }> = [
  {
    href: '/alpha-shrinking',
    title: 'Alpha is shrinking',
    eyebrow: 'The decay',
  },
  {
    href: '/anticheat-flags',
    title: 'Anti-Cheat Flags',
    eyebrow: 'The receipts',
  },
]

export function Writing() {
  return (
    <div
      style={{
        borderTop: '1px solid var(--apple-line)',
        marginTop: 12,
        paddingTop: 12,
      }}
    >
      <p
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-loose)',
          color: 'var(--apple-text-tertiary)',
          textTransform: 'uppercase',
          margin: '0 0 6px 8px',
        }}
      >
        Writing
      </p>
      <div className="flex flex-col gap-0.5">
        {ARTICLES.map((a) => (
          <Link
            key={a.href}
            href={a.href as never}
            className="flex flex-col px-2 py-2 rounded-[8px] transition-colors duration-200 hover:bg-[rgba(0,0,0,0.04)]"
            style={{
              textDecoration: 'none',
              transitionTimingFunction: 'var(--apple-ease-default)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '+0.04em',
                textTransform: 'uppercase',
                color: 'var(--apple-text-tertiary)',
                marginBottom: 2,
              }}
            >
              {a.eyebrow}
            </span>
            <span
              style={{
                fontFamily: 'var(--apple-font-text)',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: 'var(--apple-track-tight)',
                color: 'var(--apple-text-secondary)',
                lineHeight: 1.25,
              }}
            >
              {a.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
