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

export interface ItpPageConfig {
  sections: SectionId[]
  heroStyle?: 'dark' | 'brand' | 'white'
  label?: string
  createdAt?: string // ISO date string
}

const CONFIGS = {
  'crypto-top-n': {
    sections: [
      'key-stats', 'performance', 'holdings', 'breakdown', 'concentration',
      'founders', 'defi-health', 'funding', 'fund-facts', 'trade-cta',
    ],
    heroStyle: 'dark',
    label: 'Crypto Index',
    createdAt: '2026-02-18',
  },

  'defi-sector': {
    sections: [
      'key-stats', 'performance', 'holdings', 'breakdown',
      'defi-health', 'fund-facts', 'trade-cta',
    ],
    heroStyle: 'brand',
    label: 'DeFi Index',
  },

  'default': {
    sections: [
      'key-stats', 'performance', 'holdings', 'breakdown',
      'concentration', 'fund-facts', 'trade-cta',
    ],
    heroStyle: 'white',
  },
} as const satisfies Record<string, ItpPageConfig>

export type ItpPageType = keyof typeof CONFIGS

// ITP ID → page type mapping. Hardcoded for now; later: read from on-chain metadata.
const ITP_TYPE_MAP: Record<string, ItpPageType> = {
  '0x0000000000000000000000000000000000000000000000000000000000000001': 'crypto-top-n',
}

export function getItpPageConfig(itpId: string): ItpPageConfig {
  const pageType = ITP_TYPE_MAP[itpId.toLowerCase()] ?? 'default'
  return CONFIGS[pageType]
}
