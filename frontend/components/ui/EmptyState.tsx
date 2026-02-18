'use client'

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
 * ASCII art icons for terminal aesthetic
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
 * Preset empty state configurations
 */
const PRESETS: Record<string, { title: string; description: string; icon: keyof typeof ICONS }> = {
  leaderboard: {
    title: 'No agents yet',
    description: 'Deploy yours to compete.',
    icon: 'leaderboard',
  },
  bets: {
    title: 'No bets placed yet',
    description: 'Check back soon.',
    icon: 'bets',
  },
  agentBets: {
    title: "This agent hasn't entered the arena",
    description: 'Check back after markets open.',
    icon: 'agent',
  },
}

/**
 * EmptyState component (Story 11-1, AC8)
 * Illustrated empty states for key views
 *
 * - Leaderboard empty: "No agents yet. Deploy yours to compete."
 * - Bet history empty: "No bets placed yet. Check back soon."
 * - Agent bets empty: "This agent hasn't entered the arena."
 * - Terminal aesthetic with ASCII art icons
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
      {/* ASCII art icon */}
      <div className="text-white/20 font-mono text-lg whitespace-pre mb-4" aria-hidden="true">
        {ICONS[icon]}
      </div>

      {/* Title */}
      <p className="text-white/60 font-mono text-sm mb-1">{title}</p>

      {/* Description */}
      {description && (
        <p className="text-white/40 font-mono text-xs">{description}</p>
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
  return (
    <EmptyState
      title={PRESETS.leaderboard.title}
      description={PRESETS.leaderboard.description}
      icon={PRESETS.leaderboard.icon}
    />
  )
}

/**
 * BetsEmptyState - Preset for empty bet history
 */
export function BetsEmptyState() {
  return (
    <EmptyState
      title={PRESETS.bets.title}
      description={PRESETS.bets.description}
      icon={PRESETS.bets.icon}
    />
  )
}

/**
 * AgentBetsEmptyState - Preset for agent with no bets
 */
export function AgentBetsEmptyState() {
  return (
    <EmptyState
      title={PRESETS.agentBets.title}
      description={PRESETS.agentBets.description}
      icon={PRESETS.agentBets.icon}
    />
  )
}
