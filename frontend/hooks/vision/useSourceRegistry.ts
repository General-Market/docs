'use client'

import useSWR from 'swr'

interface SourceDisplay {
  sourceId: string
  internalIds?: string[]
  /** When set, the data-node emits a dedicated Vision batch keyed by this id,
   *  derived from the parent firehose's data filtered to a curated allowlist.
   *  Frontend uses this to find the right batch for the source detail page. */
  batchSubsourceKey?: string
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
  prefixes: string[]
  valueLabel: string
  valueUnit: string
  isPrice: boolean
  audience?: 'human' | 'bot' | 'redirect'
  redirectTo?: string
}

interface CategoryDisplay {
  key: string
  label: string
  order: number
}

interface SourceRegistry {
  sources: SourceDisplay[]
  categories: CategoryDisplay[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useSourceRegistry(): SourceRegistry & { isLoading: boolean } {
  const { data, isLoading } = useSWR<SourceRegistry>('/api/vision/sources', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
    fallbackData: { sources: [], categories: [] },
  })

  return {
    sources: data?.sources ?? [],
    categories: data?.categories ?? [],
    isLoading,
  }
}

export function findSource(sources: SourceDisplay[], sourceId: string) {
  return sources.find(
    s => s.sourceId === sourceId || s.internalIds?.includes(sourceId),
  )
}

/**
 * Resolve the data-node internal source ID from either a display or internal sourceId.
 * When the URL uses a display ID (e.g. "coingecko"), returns the first internal ID ("crypto")
 * so API calls to the data-node hit the correct DB rows.
 */
export function resolveInternalId(sources: SourceDisplay[], sourceId: string): string {
  const entry = findSource(sources, sourceId)
  if (!entry) return sourceId
  // If sourceId matches the display ID and there are internal aliases, use the first one
  if (entry.sourceId === sourceId && entry.internalIds?.length) {
    return entry.internalIds[0]
  }
  return sourceId
}

export function getCategoryForMarket(sources: SourceDisplay[], marketId: string): string {
  for (const source of sources) {
    for (const prefix of source.prefixes) {
      if (marketId.startsWith(prefix)) return source.category
    }
  }
  return 'other'
}

export function formatMarketDisplay(sources: SourceDisplay[], marketId: string): string {
  for (const source of sources) {
    for (const prefix of source.prefixes) {
      if (marketId.startsWith(prefix)) {
        return marketId.slice(prefix.length).replace(/_/g, ' ')
      }
    }
  }
  return marketId.replace(/_/g, ' ')
}
