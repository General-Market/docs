import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries, fetchJsonWithTimeout } from './types'

/**
 * Steam — Steam Charts endpoint returns concurrent player counts per appid.
 * We sample CS2 (730) as a proxy; Steam's public API gives current count only,
 * so we splice the live value onto a deterministic baseline curve.
 */

type SteamNumber = {
  response?: { player_count?: number; result?: number }
}

const CS2_APPID = 730

export async function getSteamFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<SteamNumber>(
    `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${CS2_APPID}`,
    4000,
  )

  let series: number[]
  let meta = 'Player counts · top titles'

  const live = data?.response?.player_count
  if (typeof live === 'number' && live > 0) {
    const base = fallbackSeries('steam', DEFAULT_RESOLUTION, live, live * 0.05, 5)
    base[base.length - 1] = live
    series = base
    meta = `CS2 live · ${live.toLocaleString()} players`
  } else {
    series = fallbackSeries('steam', DEFAULT_RESOLUTION, 0.42, 6, 5)
  }

  return {
    sourceId: 'steam',
    displayName: 'Steam',
    assetName: 'CS2',
    assetValue: typeof live === 'number' ? `${live.toLocaleString()}` : undefined,
    meta,
    coverage: 'anticheat',
    series,
  }
}
