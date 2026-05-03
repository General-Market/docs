import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries, fetchJsonWithTimeout } from './types'

type LlamaPoint = [number, number] // [unix_seconds, tvl_usd]

/**
 * DefiLlama public API — total chain TVL over 24h.
 * https://api.llama.fi/v2/historicalChainTvl
 * Public, no auth, generous rate limits.
 */
export async function getDefiLlamaFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<LlamaPoint[]>(
    'https://api.llama.fi/v2/historicalChainTvl',
    5000,
  )

  let series: number[]
  let meta = 'TVL across 240+ protocols'

  if (data && data.length > 0) {
    const tail = data.slice(-DEFAULT_RESOLUTION)
    series = tail.map(([, tvl]) => tvl)
    const last = tail[tail.length - 1]?.[1]
    if (typeof last === 'number') {
      meta = `Total DeFi TVL · $${formatBig(last)}`
    }
  } else {
    series = fallbackSeries('defillama', DEFAULT_RESOLUTION, 0.48, 6, 5)
  }

  const last = data && data.length > 0 ? data[data.length - 1]?.[1] : undefined
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
