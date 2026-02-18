'use client'

import { Tooltip } from '@/components/ui/Tooltip'

/**
 * AICapabilityBadge props interface
 */
interface AICapabilityBadgeProps {
  /** Maximum portfolio size (markets count) */
  maxPortfolioSize: number
}

/**
 * AI capability tier configuration
 */
interface TierConfig {
  label: string
  color: string
  threshold: number
}

/**
 * Tier thresholds and styling (AC2)
 * Elite: 20K+, Advanced: 15K+, Intermediate: 10K+, Beginner: <10K
 */
const TIERS: TierConfig[] = [
  { label: 'Elite', color: 'bg-accent text-white', threshold: 20000 },
  { label: 'Advanced', color: 'bg-amber-600 text-white', threshold: 15000 },
  { label: 'Intermediate', color: 'bg-blue-600 text-white', threshold: 10000 },
  { label: 'Beginner', color: 'bg-white/20 text-white', threshold: 0 }
]

/**
 * Determines the AI capability tier based on max portfolio size
 */
function getTier(maxPortfolioSize: number): TierConfig {
  for (const tier of TIERS) {
    if (maxPortfolioSize >= tier.threshold) {
      return tier
    }
  }
  return TIERS[TIERS.length - 1] // Fallback to Beginner
}

/**
 * Formats portfolio size for badge display
 * Shows "23K+ markets" format
 */
function formatBadgeText(maxPortfolioSize: number, tierLabel: string): string {
  const kMarkets = Math.floor(maxPortfolioSize / 1000)
  return `${tierLabel} - ${kMarkets}K+ markets`
}

/**
 * Tooltip explanation for each tier
 */
function getTierExplanation(tierLabel: string): string {
  switch (tierLabel) {
    case 'Elite':
      return 'Elite AI capability: Analyzes 20,000+ markets simultaneously'
    case 'Advanced':
      return 'Advanced AI capability: Analyzes 15,000+ markets simultaneously'
    case 'Intermediate':
      return 'Intermediate AI capability: Analyzes 10,000+ markets simultaneously'
    default:
      return 'Beginner AI capability: Analyzes fewer than 10,000 markets'
  }
}

/**
 * AICapabilityBadge component (AC2)
 * Displays agent's AI capability tier based on max portfolio size
 * Dev Arena themed with tier-specific colors
 */
export function AICapabilityBadge({ maxPortfolioSize }: AICapabilityBadgeProps) {
  const tier = getTier(maxPortfolioSize)
  const badgeText = formatBadgeText(maxPortfolioSize, tier.label)
  const tooltipContent = getTierExplanation(tier.label)

  return (
    <Tooltip content={tooltipContent}>
      <span
        className={`inline-flex items-center px-2 py-1 text-xs font-mono font-medium rounded ${tier.color}`}
      >
        {badgeText}
      </span>
    </Tooltip>
  )
}
