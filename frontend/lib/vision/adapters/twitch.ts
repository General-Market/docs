import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries } from './types'

/**
 * Twitch — Helix requires app-token auth that we don't want to wire on the
 * homepage path. The data-node already aggregates Twitch concurrent-viewer
 * snapshots for trading; the homepage card just needs a stable shape, which
 * the deterministic fallback provides. Replace with a proxied data-node
 * endpoint once exposed.
 */

export async function getTwitchFeed(): Promise<SourceFeed> {
  return {
    sourceId: 'twitch',
    displayName: 'Twitch',
    assetName: 'xQc · concurrent',
    assetValue: '—',
    meta: 'Concurrent viewers · top streamers',
    coverage: 'anticheat',
    series: fallbackSeries('twitch', DEFAULT_RESOLUTION, 0.65, 10, 3),
  }
}
