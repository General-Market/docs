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

const CONFIGS: Record<string, ItpPageConfig> = {
  'crypto-top-n': {
    tabs: {
      overview: ['investment-objective', 'breakdown', 'concentration', 'founders', 'defi-health', 'funding'],
      performance: ['performance'],
      'key-facts': ['fund-facts'],
      holdings: ['holdings'],
    },
    heroStyle: 'dark',
    label: 'Crypto Index',
    createdAt: '2026-02-18',
    investmentObjective: {
      whyPoints: [
        'Broad crypto exposure: Track the top 100 cryptocurrencies by market capitalization in a single product',
        'Equal weight: Every asset gets 1% allocation, reducing concentration risk vs market-cap weighted indexes',
        'On-chain settlement: Fully transparent, verifiable holdings with BLS-verified consensus',
      ],
      objective: 'The Top 100 Crypto Index seeks to track the performance of a diversified basket of the 100 largest digital assets by market capitalization, equally weighted and rebalanced periodically.',
    },
  },

  'defi-sector': {
    tabs: {
      overview: ['breakdown', 'defi-health'],
      performance: ['performance'],
      'key-facts': ['fund-facts'],
      holdings: ['holdings'],
    },
    heroStyle: 'brand',
    label: 'DeFi Index',
  },

  'default': {
    tabs: {
      overview: ['breakdown', 'concentration'],
      performance: ['performance'],
      'key-facts': ['fund-facts'],
      holdings: ['holdings'],
    },
    heroStyle: 'white',
  },
}

export type ItpPageType = keyof typeof CONFIGS

const ITP_TYPE_MAP: Record<string, ItpPageType> = {
  '0x0000000000000000000000000000000000000000000000000000000000000001': 'crypto-top-n',
}

export function getItpPageConfig(itpId: string): ItpPageConfig {
  // Check by ITP ID first (existing behavior)
  const pageType = ITP_TYPE_MAP[itpId.toLowerCase()] ?? null
  if (pageType) return CONFIGS[pageType]

  // Check by ticker from itpId mapping
  const override = (itpIdNames as Record<string, { name: string; ticker: string }>)[itpId.toLowerCase()]
  if (override?.ticker) {
    const tickerConfig = getItpPageConfigByTicker(override.ticker)
    if (tickerConfig !== CONFIGS['default']) return tickerConfig
  }

  return CONFIGS['default']
}

export function getItpPageConfigByTicker(ticker: string): ItpPageConfig {
  const content = ITP_PAGE_CONTENT[ticker.toUpperCase()]
  if (!content) return CONFIGS['default']

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
