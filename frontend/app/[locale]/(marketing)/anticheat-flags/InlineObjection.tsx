'use client'

import { Reveal } from '@/components/ui/Reveal'

const TEXT = 'var(--apple-text)'
const SECONDARY = 'var(--apple-text-secondary)'
const TERTIARY = 'var(--apple-text-tertiary)'
const LINE = 'var(--apple-line)'

interface InlineObjectionProps {
  shot: string
  reply: string
  marginTop?: number
}

export function InlineObjection({ shot, reply, marginTop = 32 }: InlineObjectionProps) {
  return (
    <Reveal delay={0.08}>
      <aside
        style={{
          marginTop,
          padding: '20px 22px',
          background: 'var(--apple-panel)',
          border: `1px solid ${LINE}`,
          borderRadius: 'var(--apple-r-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 760,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 11,
            fontWeight: 600,
            color: TERTIARY,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Objection
        </div>
        <p
          style={{
            fontFamily: 'var(--apple-font-display)',
            fontSize: 17,
            lineHeight: 1.4,
            letterSpacing: '-0.014em',
            color: TEXT,
            fontWeight: 500,
            fontStyle: 'italic',
            margin: 0,
          }}
        >
          &ldquo;{shot}&rdquo;
        </p>
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 14,
            lineHeight: 1.55,
            letterSpacing: '-0.011em',
            color: SECONDARY,
            margin: 0,
          }}
        >
          {reply}
        </p>
      </aside>
    </Reveal>
  )
}
