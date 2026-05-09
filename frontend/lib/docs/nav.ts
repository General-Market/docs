export type DocTabId = 'blocks' | 'index'

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
    id: 'blocks',
    title: 'Blocks',
    description:
      'Sealed bets across 90+ data sources. Predators excluded by construction.',
    groups: [
      {
        title: 'Getting Started',
        pages: ['blocks/introduction', 'blocks/getting-started'],
      },
      {
        title: 'Concepts',
        pages: [
          'blocks/concepts/blocks',
          'blocks/concepts/bitmaps',
          'blocks/concepts/ticks',
          'blocks/concepts/resolution-types',
          'blocks/concepts/balance-proofs',
          'blocks/concepts/fees',
          'blocks/concepts/sources',
        ],
      },
      {
        title: 'Bot Development',
        pages: [
          'blocks/bots/overview',
          'blocks/bots/quickstart',
          'blocks/bots/development',
          'blocks/bots/bitmap-encoding',
          'blocks/bots/strategies',
        ],
      },
      {
        title: 'Guides',
        pages: ['blocks/guides/adding-sources'],
      },
      {
        title: 'API Reference',
        pages: [
          'blocks/api/overview',
          'blocks/api/blocks',
          'blocks/api/state',
          'blocks/api/bitmap',
          'blocks/api/balance',
          'blocks/api/ticks',
          'blocks/api/leaderboard',
          'blocks/api/snapshot',
        ],
      },
      {
        title: 'Architecture',
        pages: [
          'blocks/architecture/overview',
          'blocks/architecture/block-lifecycle',
          'blocks/architecture/continuous-betting',
        ],
      },
      {
        title: 'Reference',
        pages: [
          'blocks/reference/contracts',
          'blocks/reference/contract-addresses',
          'blocks/reference/error-codes',
          'blocks/reference/glossary',
        ],
      },
      {
        title: 'Operations',
        pages: ['blocks/risks'],
      },
      {
        title: 'Examples',
        pages: ['blocks/examples'],
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
          'index/guides/settlement',
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
  if (slug.startsWith('blocks/')) return 'blocks'
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
