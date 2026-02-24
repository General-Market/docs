import { useQuery } from '@tanstack/react-query'
import { keccak256, toHex } from 'viem'
import { DATA_NODE_URL } from '@/lib/config'

export interface ResolvedMarket {
  /** Original string asset ID (e.g., "hn_42858764_score") */
  assetId: string
  /** Data source (e.g., "hackernews", "coingecko") */
  source: string
  /** Human-readable name (e.g., "Show HN: I built a thing") */
  name: string
  /** Ticker symbol (e.g., "HN#42858764") */
  symbol: string
  /** Current price/value */
  value: number
  /** Percent change (nullable) */
  changePct: number | null
  /** Link to original source page */
  url: string
}

/** Build the source URL from an asset ID and source */
function buildSourceUrl(assetId: string, source: string): string {
  if (source === 'hackernews') {
    // assetId format: "hn_{storyId}_score" or "hn_{storyId}_comments"
    const match = assetId.match(/^hn_(\d+)_/)
    if (match) return `https://news.ycombinator.com/item?id=${match[1]}`
  }
  if (source === 'coingecko') {
    const rawId = assetId.replace(/^crypto_/, '')
    return `https://www.coingecko.com/en/coins/${rawId}`
  }
  if (source === 'finnhub' || source === 'stocks') {
    const ticker = assetId.replace(/^stock(s?)_/, '')
    return `https://finance.yahoo.com/quote/${ticker}`
  }
  if (source === 'polymarket') {
    const condId = assetId.replace(/^poly_/, '')
    return `https://polymarket.com/event/${condId}`
  }
  if (source === 'fred' || source === 'rates') {
    return `https://fred.stlouisfed.org/series/${assetId}`
  }
  return ''
}

/**
 * Fetches the market snapshot from the data-node and builds a reverse lookup
 * from on-chain bytes32 market IDs to human-readable market info.
 *
 * On-chain market IDs are keccak256(toHex(assetId)), so we hash each
 * data-node asset and match against the batch's bytes32 IDs.
 */
export function useResolvedMarkets(batchMarketIds: string[]) {
  return useQuery<Map<string, ResolvedMarket>>({
    queryKey: ['resolved-markets', batchMarketIds.length],
    queryFn: async () => {
      const res = await fetch(`${DATA_NODE_URL}/vision/snapshot?limit=100000`)
      if (!res.ok) return new Map()
      const data = await res.json()
      const snapshots: any[] = data.snapshots ?? []

      // Build a Set of batch market IDs for fast lookup (normalized to lowercase)
      const batchSet = new Set(batchMarketIds.map(id => id.toLowerCase()))

      const lookup = new Map<string, ResolvedMarket>()
      for (const s of snapshots) {
        const assetId = s.assetId ?? s.asset_id ?? ''
        if (!assetId) continue

        const hash = keccak256(toHex(assetId)).toLowerCase()
        if (!batchSet.has(hash)) continue

        const source = s.source ?? ''
        lookup.set(hash, {
          assetId,
          source,
          name: s.name || assetId,
          symbol: s.symbol || '',
          value: typeof s.value === 'number' ? s.value : parseFloat(s.value) || 0,
          changePct: s.changePct != null ? parseFloat(s.changePct) : null,
          url: buildSourceUrl(assetId, source),
        })
      }

      return lookup
    },
    enabled: batchMarketIds.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
