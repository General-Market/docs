import type { SourceFeed } from './types'
import { pickSourceSeries, fetchSourceMarketCount, formatMarketCount } from './data-node-history'

/**
 * Nasdaq — the data-node already collects U.S. stock prices into the
 * `stocks` source. The home card pins AAPL because it's the most legible
 * symbol on Earth; if its history is too thin, we let the ranker pick the
 * highest-priced stock with usable depth.
 *
 * Pill says "Anti-Cheat" because the on-chain markets that reference
 * Nasdaq-listed equities settle through the BLS-verified oracle pipeline.
 * The price feed itself is just a chart.
 */
const PINNED = 'AAPL'

export async function getNasdaqFeed(): Promise<SourceFeed> {
  const picked = await pickSourceSeries('stocks', {
    rankBy: 'value',
    preferredAssetId: PINNED,
    minPoints: 8,
    maxSeriesPoints: 64,
  })

  if (!picked) {
    const total = await fetchSourceMarketCount('stocks')
    return {
      sourceId: 'nasdaq',
      displayName: 'Nasdaq',
      assetValue: total > 0 ? formatMarketCount(total) : undefined,
      meta: 'Nasdaq-listed · pre-market + close',
      coverage: 'anticheat',
      series: [],
    }
  }

  const symbol = picked.asset.symbol ?? picked.asset.name ?? 'Top stock'
  const price = picked.last ?? 0
  return {
    sourceId: 'nasdaq',
    displayName: 'Nasdaq',
    assetName: symbol,
    assetValue: formatMarketCount(picked.total),
    meta: price > 0 ? `${symbol} · $${price.toFixed(2)}` : 'Nasdaq-listed · pre-market + close',
    coverage: 'anticheat',
    series: picked.series,
  }
}
