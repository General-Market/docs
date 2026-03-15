'use client'

import useSWR from 'swr'

interface SourceDisplay {
  sourceId: string
  name: string
  description: string
  category: string
  logo: string
  brandBg: string
  prefixes: string[]
  valueLabel: string
  valueUnit: string
  isPrice: boolean
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
  return sources.find(s => s.sourceId === sourceId)
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
