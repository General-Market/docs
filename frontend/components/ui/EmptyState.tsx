'use client'

import { useTranslations } from 'next-intl'

interface EmptyStateProps {
  /** Title text */
  title: string
  /** Description text */
  description?: string
  /** Icon variant */
  icon?: 'default' | 'bets' | 'leaderboard' | 'agent'
  /** Optional action button */
  action?: React.ReactNode
  /** Additional className */
  className?: string
}

/**
 * Simple geometric icons for institutional aesthetic
 */
const ICONS = {
  default: `○ ○ ○`,
  bets: `┌─────┐
│ $0  │
└─────┘`,
  leaderboard: `#1 ───
#2 ───
#3 ───`,
  agent: `┌─┐
│?│
└─┘`,
}

/**
 * Preset icon mapping
 */
const PRESET_ICONS: Record<string, keyof typeof ICONS> = {
  leaderboard: 'leaderboard',
  bets: 'bets',
  agentBets: 'agent',
}

/**
 * EmptyState component (Story 11-1, AC8)
 * Illustrated empty states for key views
 * Institutional style: muted text on white card surface
 */
export function EmptyState({
  title,
  description,
  icon = 'default',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`py-12 text-center ${className}`}>
      {/* Icon */}
      <div className="text-text-muted font-mono text-lg whitespace-pre mb-4" aria-hidden="true">
        {ICONS[icon]}
      </div>

      {/* Title */}
      <p className="text-text-secondary font-medium text-sm mb-1">{title}</p>

      {/* Description */}
      {description && (
        <p className="text-text-muted text-xs">{description}</p>
      )}

      {/* Action button */}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * LeaderboardEmptyState - Preset for empty leaderboard
 */
export function LeaderboardEmptyState() {
  const t = useTranslations('common')
  return (
    <EmptyState
      title={t('empty.no_agents')}
      description={t('empty.no_agents_deploy')}
      icon={PRESET_ICONS.leaderboard}
    />
  )
}

/**
 * BetsEmptyState - Preset for empty bet history
 */
export function BetsEmptyState() {
  const t = useTranslations('common')
  return (
    <EmptyState
      title={t('empty.no_bets')}
      description={t('empty.no_bets_check_back')}
      icon={PRESET_ICONS.bets}
    />
  )
}

/**
 * AgentBetsEmptyState - Preset for agent with no bets
 */
export function AgentBetsEmptyState() {
  const t = useTranslations('common')
  return (
    <EmptyState
      title={t('empty.agent_no_bets')}
      description={t('empty.agent_no_bets_hint')}
      icon={PRESET_ICONS.agentBets}
    />
  )
}
