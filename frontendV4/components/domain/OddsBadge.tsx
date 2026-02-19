'use client'

import { Tooltip } from '@/components/ui/Tooltip'

export type OddsFavorability = 'favorable' | 'even' | 'unfavorable'

interface OddsBadgeProps {
  /** The odds display string (e.g., "2.00x") */
  display: string
  /** Favorability level determines color */
  favorability: OddsFavorability
  /** Optional className for additional styling */
  className?: string
}

/**
 * Color classes based on favorability for matcher
 * Green = favorable to matcher (they get better odds)
 * Yellow = even odds (roughly 1:1)
 * Red = unfavorable to matcher (creator has advantage)
 */
const favorabilityColors: Record<OddsFavorability, string> = {
  favorable: 'bg-green-900/80 text-green-300 border-green-700',
  even: 'bg-yellow-900/80 text-yellow-300 border-yellow-700',
  unfavorable: 'bg-red-900/80 text-red-300 border-red-700'
}

const favorabilityTooltips: Record<OddsFavorability, string> = {
  favorable: 'Favorable odds for matchers - higher potential return',
  even: 'Even odds - balanced risk/reward',
  unfavorable: 'Unfavorable odds for matchers - lower potential return'
}

/**
 * OddsBadge component
 * Displays odds with color coding based on favorability
 *
 * AC1: Display odds prominently as a badge
 * AC1: Use color coding: green for favorable to matcher, yellow for even, red for unfavorable
 */
export function OddsBadge({ display, favorability, className = '' }: OddsBadgeProps) {
  const colorClass = favorabilityColors[favorability]
  const tooltip = favorabilityTooltips[favorability]

  return (
    <Tooltip content={tooltip}>
      <span
        className={`inline-flex items-center px-3 py-1 rounded text-sm font-bold font-mono border cursor-help ${colorClass} ${className}`}
        role="status"
        aria-label={`Odds: ${display}, ${favorability} for matchers`}
      >
        {display} Odds
      </span>
    </Tooltip>
  )
}
