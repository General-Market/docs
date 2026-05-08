export type DocTabId = 'vision' | 'index'

export type DocGroup = {
  title: string
  pages: string[]
}

export type DocTab = {
  id: DocTabId
  title: string
  description: string
  groups: DocGroup[]
}

export const DOCS_NAV: DocTab[] = [
  {
    id: 'vision',
    title: 'Vision',
    description: 'Prediction markets on real-world data. Sealed bets. Parimutuel resolution.',
    groups: [
      {
        title: 'Getting Started',
        pages: ['vision/introduction', 'vision/getting-started'],
      },
      {
        title: 'Concepts',
        pages: [
          'vision/concepts/blocks',
          'vision/concepts/bitmaps',
          'vision/concepts/ticks',
          'vision/concepts/resolution-types',
          'vision/concepts/balance-proofs',
          'vision/concepts/fees',
          'vision/concepts/sources',
          'vision/concepts/points',
        ],
      },
      {
        title: 'Bot Development',
        pages: [
          'vision/bots/overview',
          'vision/bots/quickstart',
          'vision/bots/development',
          'vision/bots/bitmap-encoding',
          'vision/bots/strategies',
          'vision/bots/lifecycle',
        ],
      },
      {
        title: 'Guides',
        pages: ['vision/guides/sources-browser', 'vision/guides/adding-sources'],
      },
      {
        title: 'API Reference',
        pages: [
          'vision/api/overview',
          'vision/api/blocks',
          'vision/api/state',
          'vision/api/bitmap',
          'vision/api/balance',
          'vision/api/ticks',
          'vision/api/leaderboard',
          'vision/api/snapshot',
        ],
      },
      {
        title: 'Architecture',
        pages: [
          'vision/architecture/overview',
          'vision/architecture/block-lifecycle',
          'vision/architecture/continuous-betting',
        ],
      },
      {
        title: 'Reference',
        pages: [
          'vision/reference/resolution-types',
          'vision/reference/contracts',
          'vision/reference/contract-addresses',
          'vision/reference/error-codes',
          'vision/reference/glossary',
        ],
      },
      {
        title: 'Operations',
        pages: ['vision/risks'],
      },
      {
        title: 'Examples',
        pages: ['vision/examples'],
      },
    ],
  },
  {
    id: 'index',
    title: 'Index',
    description: 'On-chain index products. NAV oracle. Order lifecycle.',
    groups: [
      {
        title: 'Getting Started',
        pages: ['index/introduction', 'index/getting-started'],
      },
      {
        title: 'Concepts',
        pages: [
          'index/concepts/itps',
          'index/concepts/order-lifecycle',
          'index/concepts/lending',
        ],
      },
      {
        title: 'Guides',
        pages: [
          'index/guides/buy-sell',
          'index/guides/create-itp',
          'index/guides/rebalancing',
          'index/guides/backtesting',
          'index/guides/lending',
          'index/guides/settlement',
          'index/guides/explorer',
          'index/guides/risks',
        ],
      },
      {
        title: 'API Reference',
        pages: [
          'index/api/overview',
          'index/api/prices',
          'index/api/itps',
          'index/api/portfolio',
          'index/api/simulation',
          'index/api/morpho',
          'index/api/infrastructure',
        ],
      },
      {
        title: 'Architecture',
        pages: [
          'index/architecture/overview',
          'index/architecture/contracts',
          'index/architecture/oracle-nodes',
          'index/architecture/data-node',
          'index/architecture/bridge',
          'index/architecture/curator',
        ],
      },
      {
        title: 'Reference',
        pages: [
          'index/reference/error-codes',
          'index/reference/contract-addresses',
          'index/reference/glossary',
        ],
      },
    ],
  },
]

export function pageHref(slug: string): string {
  return `/docs/${slug}`
}

export function findTabForSlug(slug: string): DocTabId | null {
  if (slug.startsWith('vision/')) return 'vision'
  if (slug.startsWith('index/')) return 'index'
  return null
}

export function flattenSlugs(): string[] {
  return DOCS_NAV.flatMap(tab => tab.groups.flatMap(g => g.pages))
}

export function adjacentPages(slug: string): { prev: string | null; next: string | null } {
  const all = flattenSlugs()
  const i = all.indexOf(slug)
  if (i === -1) return { prev: null, next: null }
  return {
    prev: i > 0 ? all[i - 1] : null,
    next: i < all.length - 1 ? all[i + 1] : null,
  }
}
