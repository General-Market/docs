import type { SourceFeed } from './types'
import { pickSourceSeries, formatCount, fetchSourceMarketCount, formatMarketCount } from './data-node-history'

/**
 * Steam — concurrent player counts per game, sampled by the data-node
 * collector. The home card pins Counter-Strike (appid 730) when present;
 * if its history is too thin we let the ranker pick the most-played title.
 */
const CS2_ASSET_ID = 'steam_game_730'

export async function getSteamFeed(): Promise<SourceFeed> {
  const picked = await pickSourceSeries('steam', {
    rankBy: 'value',
    preferredAssetId: CS2_ASSET_ID,
    minPoints: 12,
    maxSeriesPoints: 64,
  })

  if (!picked) {
    const total = await fetchSourceMarketCount('steam')
    return {
      sourceId: 'steam',
      displayName: 'Steam',
      assetValue: total > 0 ? formatMarketCount(total) : undefined,
      meta: 'Player counts · top titles',
      coverage: 'anticheat',
      series: [],
    }
  }

  const name = picked.asset.name ?? picked.asset.symbol ?? 'Top game'
  const last = picked.last ?? 0
  return {
    sourceId: 'steam',
    displayName: 'Steam',
    assetName: name,
    assetValue: formatMarketCount(picked.total),
    meta: last > 0 ? `${name} · ${formatCount(last)} players` : 'Player counts · top titles',
    coverage: 'anticheat',
    series: picked.series,
  }
}
