import type { SourceFeed } from './types'
import { pickSourceSeries, formatCount, fetchSourceMarketCount, formatMarketCount } from './data-node-history'

/**
 * Twitch — concurrent-viewer counts per game, recorded by the data-node
 * collector at minute resolution. Pick the highest-viewer game right now,
 * fetch its 7-day series. The chart moves; the truth moves with it.
 */
export async function getTwitchFeed(): Promise<SourceFeed> {
  const picked = await pickSourceSeries('twitch', {
    rankBy: 'value',
    minPoints: 12,
    maxSeriesPoints: 64,
  })

  if (!picked) {
    const total = await fetchSourceMarketCount('twitch')
    return {
      sourceId: 'twitch',
      displayName: 'Twitch',
      assetValue: total > 0 ? formatMarketCount(total) : undefined,
      meta: 'Concurrent viewers · top streams',
      coverage: 'anticheat',
      series: [],
    }
  }

  const name = picked.asset.name ?? picked.asset.symbol ?? 'Top game'
  const last = picked.last ?? 0
  return {
    sourceId: 'twitch',
    displayName: 'Twitch',
    assetName: name,
    assetValue: formatMarketCount(picked.total),
    meta: last > 0 ? `${name} · ${formatCount(last)} concurrent` : 'Concurrent viewers · top streams',
    coverage: 'anticheat',
    series: picked.series,
  }
}
