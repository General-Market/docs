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
  favorable: 'bg-color-up/20 text-color-up border-color-up/50',
  even: 'bg-color-warning/20 text-color-warning border-color-warning/50',
  unfavorable: 'bg-color-down/20 text-color-down border-color-down/50'
}

const favorabilityTooltips: Record<OddsFavorability, string> = {
  favorable: 'Favorable odds for the opposing side - higher potential return',
  even: 'Even odds - balanced risk/reward',
  unfavorable: 'Unfavorable odds for the opposing side - lower potential return'
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
        aria-label={`Odds: ${display}, ${favorability} for the opposing side`}
      >
        {display} Odds
      </span>
    </Tooltip>
  )
}
