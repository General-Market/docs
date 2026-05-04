import type { SourceFeed } from './types'

/**
 * Twitch — Helix requires app-token auth and the data-node already aggregates
 * concurrent-viewer snapshots for trading. The homepage card has no real
 * time-series upstream yet, so we return an empty series. The Sparkline
 * component renders nothing for empty data — honest absence, not a fake curve.
 */

export async function getTwitchFeed(): Promise<SourceFeed> {
  return {
    sourceId: 'twitch',
    displayName: 'Twitch',
    assetName: 'xQc · concurrent',
    meta: 'Concurrent viewers · top streamers',
    coverage: 'anticheat',
    series: [],
  }
}
