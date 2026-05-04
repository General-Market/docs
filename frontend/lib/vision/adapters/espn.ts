import type { SourceFeed } from './types'
import { fetchJsonWithTimeout } from './types'

/**
 * ESPN public scoreboard — point-in-time NBA games. ESPN does not expose
 * minute-level activity history, so we render no curve. The card uses the
 * count of live games and a featured matchup name as the legible signal.
 */

type EspnEvent = {
  name?: string
  shortName?: string
}

type EspnScoreboard = {
  events?: EspnEvent[]
}

export async function getEspnFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<EspnScoreboard>(
    'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    5000,
  )

  const events = data?.events ?? []
  const liveCount = events.length

  const meta = liveCount > 0
    ? `${liveCount} game${liveCount === 1 ? '' : 's'} on the board`
    : 'NBA · NFL · MLB · soccer'

  const featured = events[0]
  const featuredName = featured?.shortName ?? featured?.name
  return {
    sourceId: 'espn',
    displayName: 'ESPN',
    assetName: featuredName ?? 'NBA tonight',
    assetValue: liveCount > 0 ? `${liveCount} live` : undefined,
    meta,
    coverage: 'anticheat',
    series: [],
  }
}
