import type { SourceFeed } from './types'
import { fetchJsonWithTimeout } from './types'

/**
 * Steam — GetNumberOfCurrentPlayers returns a single live count for an appid
 * (CS2 / 730). One number is not a time-series; splicing it onto a fake
 * baseline is the kind of thing UI dashboards do when they're pretending.
 * We carry the live count as a value chip and render no curve.
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

  let meta = 'Player counts · top titles'
  const live = data?.response?.player_count
  if (typeof live === 'number' && live > 0) {
    meta = `CS2 live · ${live.toLocaleString()} players`
  }

  return {
    sourceId: 'steam',
    displayName: 'Steam',
    assetName: 'CS2',
    assetValue: typeof live === 'number' ? `${live.toLocaleString()}` : undefined,
    meta,
    coverage: 'anticheat',
    series: [],
  }
}
