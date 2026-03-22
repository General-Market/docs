import { ITP_PAGE_CONTENT } from './itp-page-content'
import itpIdNames from './itp-id-names.json'

// Section IDs — each maps to one React component
export type SectionId =
  | 'key-stats'
  | 'performance'
  | 'holdings'
  | 'breakdown'
  | 'concentration'
  | 'founders'
  | 'defi-health'
  | 'funding'
  | 'fund-facts'
  | 'trade-cta'
  | 'investment-objective'

export type TabId = 'overview' | 'performance' | 'key-facts' | 'holdings'

export interface ItpPageConfig {
  tabs: Record<TabId, SectionId[]>
  heroStyle?: 'dark' | 'brand' | 'white'
  label?: string
  createdAt?: string
  investmentObjective?: {
    whyPoints: string[]
    objective: string
  }
}

const DEFAULT_CONFIG: ItpPageConfig = {
  tabs: {
    overview: ['breakdown', 'concentration'],
    performance: ['performance'],
    'key-facts': ['fund-facts'],
    holdings: ['holdings'],
  },
  heroStyle: 'white',
}

export function getItpPageConfig(itpId: string): ItpPageConfig {
  const override = (itpIdNames as Record<string, { name: string; ticker: string }>)[itpId.toLowerCase()]
  if (override?.ticker) {
    const tickerConfig = getItpPageConfigByTicker(override.ticker)
    if (tickerConfig !== DEFAULT_CONFIG) return tickerConfig
  }

  return DEFAULT_CONFIG
}

export function getItpPageConfigByTicker(ticker: string): ItpPageConfig {
  const content = ITP_PAGE_CONTENT[ticker.toUpperCase()]
  if (!content) return DEFAULT_CONFIG

  return {
    tabs: {
      overview: ['investment-objective', 'breakdown', 'concentration', 'founders'],
      performance: ['performance'],
      'key-facts': ['fund-facts'],
      holdings: ['holdings'],
    },
    heroStyle: 'white',
    label: content.label,
    investmentObjective: {
      whyPoints: content.whyPoints,
      objective: content.objective,
    },
  }
}
