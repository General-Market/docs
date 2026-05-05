import type { SourceFeed } from './types'
import { pickSourceSeries, formatBigNumber, fetchSourceMarketCount, formatMarketCount } from './data-node-history'

/**
 * Polymarket — top market by 24h volume. The data-node tracks per-market
 * implied-probability ticks, so the home sparkline is the actual price
 * trajectory of whatever the public is throwing money at right now.
 * `external` because Polymarket's orderbook isn't Anti-Cheat — we plot
 * the data, the pill admits the venue.
 */

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

export async function getPolymarketFeed(): Promise<SourceFeed> {
  const picked = await pickSourceSeries('polymarket', {
    rankBy: 'volume24h',
    // Top-volume markets are sometimes too fresh to have history; require a
    // chart-worthy depth before accepting.
    minPoints: 16,
    maxSeriesPoints: 64,
  })

  if (!picked) {
    const total = await fetchSourceMarketCount('polymarket')
    return {
      sourceId: 'polymarket',
      displayName: 'Polymarket',
      assetValue: total > 0 ? formatMarketCount(total) : undefined,
      meta: 'Prediction markets · live volume',
      coverage: 'external',
      series: [],
      external: true,
    }
  }

  const question = truncate(picked.asset.name ?? 'Top market', 60)
  const vol24 = Number(picked.asset.volume24h ?? 0)

  return {
    sourceId: 'polymarket',
    displayName: 'Polymarket',
    assetName: question,
    assetValue: formatMarketCount(picked.total),
    meta: vol24 > 0 ? `Top market · 24h $${formatBigNumber(vol24)}` : 'Prediction markets · live volume',
    coverage: 'external',
    series: picked.series,
    external: true,
  }
}
