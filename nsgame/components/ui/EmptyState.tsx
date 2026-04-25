'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

type IconKey = 'default' | 'bets' | 'leaderboard' | 'agent'

interface EmptyStateProps {
  /** Primary line. Sentence case. 14px. */
  title: string
  /** Optional secondary line. 12px. The next move, not an apology. */
  description?: string
  /** Monochrome line-icon variant. Pass null for none. */
  icon?: IconKey | null
  /** Optional action (button, link). */
  action?: React.ReactNode
  /** Extra className applied to the outer container. */
  className?: string
}

// One stroke, no fill. Decoration that admits it is decoration.
function LineIcon({ variant }: { variant: IconKey }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (variant) {
    case 'bets':
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M8 12h8" />
        </svg>
      )
    case 'leaderboard':
      return (
        <svg {...common}>
          <path d="M5 20V11" />
          <path d="M12 20V5" />
          <path d="M19 20v-6" />
        </svg>
      )
    case 'agent':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 10h.01" />
          <path d="M15 10h.01" />
          <path d="M9 15c1 .8 2 1.2 3 1.2s2-.4 3-1.2" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

/**
 * EmptyState — a quieter visual.
 * Hairline border, centred copy, optional monochrome icon. Nothing pleads.
 */
export function EmptyState({
  title,
  description,
  icon = 'default',
  action,
  className = '',
}: EmptyStateProps) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      className={`
        rounded-xl border border-zinc-200/70 bg-white
        py-16 px-6 text-center
        motion-safe:transition-opacity motion-safe:duration-200
        ${shown ? 'opacity-100' : 'opacity-0'}
        ${className}
      `}
    >
      {icon !== null && (
        <div className="mb-4 flex justify-center text-zinc-400">
          <LineIcon variant={icon} />
        </div>
      )}

      <p className="text-[14px] text-zinc-700">{title}</p>

      {description && (
        <p className="mt-1 text-[12px] text-zinc-500">{description}</p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * LeaderboardEmptyState — preset.
 */
export function LeaderboardEmptyState() {
  const t = useTranslations('common')
  return (
    <EmptyState
      title={t('empty.no_agents')}
      description={t('empty.no_agents_deploy')}
      icon="leaderboard"
    />
  )
}

/**
 * BetsEmptyState — preset.
 */
export function BetsEmptyState() {
  const t = useTranslations('common')
  return (
    <EmptyState
      title={t('empty.no_bets')}
      description={t('empty.no_bets_check_back')}
      icon="bets"
    />
  )
}

/**
 * AgentBetsEmptyState — preset.
 */
export function AgentBetsEmptyState() {
  const t = useTranslations('common')
  return (
    <EmptyState
      title={t('empty.agent_no_bets')}
      description={t('empty.agent_no_bets_hint')}
      icon="agent"
    />
  )
}
