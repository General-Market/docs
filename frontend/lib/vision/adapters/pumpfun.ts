import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries, fetchJsonWithTimeout } from './types'

/**
 * Pumpfun — the public frontend.pump.fun endpoint exposes recent coin launches.
 * We fall back gracefully when the API rate-limits us. Marked `external` because
 * pumpfun is upstream of Anti-Cheat coverage.
 */

type PumpCoin = {
  mint?: string
  market_cap?: number
  usd_market_cap?: number
  reply_count?: number
  created_timestamp?: number
}

export async function getPumpfunFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<PumpCoin[]>(
    'https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC',
    5000,
    { headers: { Accept: 'application/json' } },
  )

  let series: number[]
  let meta = 'Solana memecoin launches'

  if (data && data.length > 0) {
    const caps = data
      .map((c) => Number(c.usd_market_cap ?? c.market_cap ?? 0))
      .filter((v) => Number.isFinite(v) && v > 0)
      .slice(0, DEFAULT_RESOLUTION)
      .reverse()

    if (caps.length >= 4) {
      series = caps
      meta = `${data.length} fresh launches · last hour`
    } else {
      series = fallbackSeries('pumpfun', DEFAULT_RESOLUTION, 0.70, 14, 6)
    }
  } else {
    series = fallbackSeries('pumpfun', DEFAULT_RESOLUTION, 0.70, 14, 6)
  }

  return {
    sourceId: 'pumpfun',
    displayName: 'Pumpfun',
    meta,
    coverage: 'external',
    series,
    external: true,
  }
}
