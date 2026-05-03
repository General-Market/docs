import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries, fetchJsonWithTimeout } from './types'

/**
 * ESPN public scoreboard — counts NBA games today as the "activity" curve.
 * Endpoint: site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
 * The series is synthesized from the count + per-game scores so the card has
 * a meaningful stationary shape. ESPN does not expose minute-level history;
 * we derive a curve from current state + fallback noise.
 */

type EspnEvent = {
  competitions?: Array<{
    competitors?: Array<{ score?: string }>
  }>
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
  const scoreSamples: number[] = []

  for (const ev of events) {
    for (const c of ev.competitions ?? []) {
      for (const team of c.competitors ?? []) {
        const s = parseInt(team.score ?? '', 10)
        if (Number.isFinite(s)) scoreSamples.push(s)
      }
    }
  }

  const series =
    scoreSamples.length >= 4
      ? smearToResolution(scoreSamples, DEFAULT_RESOLUTION)
      : fallbackSeries('espn', DEFAULT_RESOLUTION, 0.50, 5, 6)

  const meta = liveCount > 0
    ? `${liveCount} game${liveCount === 1 ? '' : 's'} on the board`
    : 'NBA · NFL · MLB · soccer'

  return {
    sourceId: 'espn',
    displayName: 'ESPN',
    meta,
    coverage: 'anticheat',
    series,
  }
}

function smearToResolution(samples: number[], n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (samples.length - 1)
    const lo = Math.floor(t)
    const hi = Math.min(samples.length - 1, lo + 1)
    const frac = t - lo
    out.push(samples[lo] * (1 - frac) + samples[hi] * frac)
  }
  return out
}
