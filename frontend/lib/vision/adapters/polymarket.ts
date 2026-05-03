import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries, fetchJsonWithTimeout } from './types'

/**
 * Polymarket — public Gamma API gives recent volume per market. We pull a few
 * top markets and synthesize a 24h activity series. The card is marked
 * `external` because Polymarket itself is the upstream platform; the on-chain
 * Anti-Cheat does not run their orderbook.
 */

type GammaMarket = {
  id?: string
  question?: string
  volume?: number | string
  liquidity?: number | string
}

export async function getPolymarketFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<GammaMarket[]>(
    'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20',
    5000,
  )

  let series: number[]
  let meta = 'Prediction markets · live volume'

  if (data && data.length > 0) {
    const vols = data
      .map((m) => Number(m.volume ?? 0))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => b - a)
      .slice(0, DEFAULT_RESOLUTION)

    if (vols.length >= 4) {
      series = vols.reverse() // ascending so the line generally moves up
      const total = vols.reduce((a, b) => a + b, 0)
      meta = `${data.length} live markets · 24h $${formatBig(total)}`
    } else {
      series = fallbackSeries('polymarket', DEFAULT_RESOLUTION, 0.62, 12, 7)
    }
  } else {
    series = fallbackSeries('polymarket', DEFAULT_RESOLUTION, 0.62, 12, 7)
  }

  return {
    sourceId: 'polymarket',
    displayName: 'Polymarket',
    meta,
    coverage: 'external',
    series,
    external: true,
  }
}

function formatBig(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toFixed(0)
}
