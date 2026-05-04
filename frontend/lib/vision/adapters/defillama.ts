import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fetchJsonWithTimeout } from './types'

// DefiLlama returns either {date, tvl} objects or [unix, tvl] tuples
// depending on endpoint vintage. Handle both shapes.
type LlamaPoint = { date?: number; tvl?: number } | [number, number]

/**
 * DefiLlama public API — total chain TVL over 24h.
 * https://api.llama.fi/v2/historicalChainTvl
 * Public, no auth, generous rate limits. Real time-series.
 */
export async function getDefiLlamaFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<LlamaPoint[]>(
    'https://api.llama.fi/v2/historicalChainTvl',
    5000,
  )

  let series: number[] = []
  let meta = 'TVL across 240+ protocols'
  let last: number | undefined

  const extract = (p: LlamaPoint): number | undefined => {
    if (Array.isArray(p)) return typeof p[1] === 'number' ? p[1] : undefined
    return typeof p?.tvl === 'number' ? p.tvl : undefined
  }

  if (data && data.length > 0) {
    const tail = data.slice(-DEFAULT_RESOLUTION)
    series = tail
      .map(extract)
      .filter((v): v is number => typeof v === 'number' && v > 0)
    const lastPt = extract(tail[tail.length - 1])
    if (typeof lastPt === 'number' && lastPt > 0) {
      last = lastPt
      meta = `Total DeFi TVL · $${formatBig(lastPt)}`
    }
  }

  return {
    sourceId: 'defillama',
    displayName: 'DefiLlama',
    assetName: 'Total DeFi TVL',
    assetValue: typeof last === 'number' ? `$${formatBig(last)}` : undefined,
    meta,
    coverage: 'anticheat',
    series,
  }
}

function formatBig(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  return n.toFixed(0)
}
