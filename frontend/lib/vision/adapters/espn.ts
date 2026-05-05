import type { SourceFeed } from './types'
import { fetchJsonWithTimeout } from './types'
import { fetchSourceMarketCount, formatMarketCount } from './data-node-history'

/**
 * ESPN — game count per day across the last seven days. The data-node
 * doesn't carry ESPN, so we hit the public scoreboard directly with
 * `?dates=YYYYMMDD` to get historical events. The series is a real
 * pulse of basketball activity over the week — high on game nights,
 * empty on rest days. Today's count and the featured matchup feed the
 * value chip.
 */

type EspnEvent = {
  name?: string
  shortName?: string
}

type EspnScoreboard = {
  events?: EspnEvent[]
}

function dateToYYYYMMDD(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export async function getEspnFeed(): Promise<SourceFeed> {
  const today = new Date()
  const dates: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    dates.push(dateToYYYYMMDD(d))
  }

  // Past 7 days of NBA scoreboard counts. One sport keeps the call budget
  // tight (7 fetches at the 600s revalidate boundary).
  const series = await Promise.all(
    dates.map(async (date) => {
      const r = await fetchJsonWithTimeout<EspnScoreboard>(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`,
        4000,
      ).catch(() => null)
      return r?.events?.length ?? 0
    }),
  )

  // Today (live) drives the assetName. Markets count comes from the
  // data-node — that's what the platform actually lists.
  const [live, marketCount] = await Promise.all([
    fetchJsonWithTimeout<EspnScoreboard>(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      5000,
    ),
    fetchSourceMarketCount('espn'),
  ])
  const events = live?.events ?? []
  const liveCount = events.length
  const featured = events[0]
  const featuredName = featured?.shortName ?? featured?.name

  const meta =
    liveCount > 0
      ? `${liveCount} game${liveCount === 1 ? '' : 's'} on the board`
      : 'NBA · weekly cadence'

  return {
    sourceId: 'espn',
    displayName: 'ESPN',
    assetName: featuredName ?? 'NBA · 7d',
    assetValue: marketCount > 0 ? formatMarketCount(marketCount) : undefined,
    meta,
    coverage: 'soon',
    series,
    hrefOverride: '/sources',
  }
}
