import type { SourceFeed } from './types'
import {
  pickSourceSeries,
  fetchSourceMarketCount,
  formatMarketCount,
} from './data-node-history'

/**
 * Sports — live odds and scores per match across NFL, NBA, MLB, NHL,
 * Bundesliga, Premier League. The data-node tracks per-side moneyline
 * values; we plot the sharpest mover. Real games, real movement.
 */

function shortName(name?: string): string {
  if (!name) return 'Top match'
  // "Borussia Dortmund vs Borussia Mönchengladbach (home) [Bundesliga]"
  // → "Borussia Dortmund vs Borussia Mönchengladbach"
  return name
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s*\[[^\]]*\]\s*/g, '')
    .trim() || name
}

export async function getSportsFeed(): Promise<SourceFeed> {
  const picked = await pickSourceSeries('sports', {
    rankBy: 'value',
    minPoints: 8,
    maxSeriesPoints: 64,
    // Skip 0-value totals; they're stale fixtures.
    filter: (a) => Number(a.value ?? 0) > 0,
  })

  if (!picked) {
    const total = await fetchSourceMarketCount('sports')
    return {
      sourceId: 'sports',
      displayName: 'Sports',
      assetValue: total > 0 ? formatMarketCount(total) : undefined,
      meta: 'NFL · NBA · MLB · NHL · soccer',
      coverage: 'anticheat',
      series: [],
    }
  }

  const name = shortName(picked.asset.name)
  return {
    sourceId: 'sports',
    displayName: 'Sports',
    assetName: name,
    assetValue: formatMarketCount(picked.total),
    meta: 'NFL · NBA · MLB · NHL · soccer',
    coverage: 'anticheat',
    series: picked.series,
  }
}
