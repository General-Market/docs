import type { SourceFeed } from './types'
import { fetchJsonWithTimeout } from './types'
import { getAaDataNodeUrl } from '@/lib/config'

/**
 * ISS — live altitude from wheretheiss.at, orbital sweep from the data-node's
 * recorded latitude stream. The latitude wave is the satellite's real path
 * across our sky over the last few hours — sine-shaped because orbits are.
 * Not synthesis. Not a fallback. Real motion through real space.
 */

type IssState = {
  altitude?: number
  velocity?: number
  latitude?: number
  longitude?: number
}

type LatitudeHistory = {
  prices?: { value?: string | number }[]
}

const ISS_NORAD_ID = 25544

export async function getIssFeed(): Promise<SourceFeed> {
  const [live, history] = await Promise.all([
    fetchJsonWithTimeout<IssState>(
      `https://api.wheretheiss.at/v1/satellites/${ISS_NORAD_ID}`,
      4000,
    ),
    fetchJsonWithTimeout<LatitudeHistory>(
      `${getAaDataNodeUrl()}/market/prices/iss/iss_latitude/history`,
      5000,
    ),
  ])

  // Last 48 samples ≈ 8 hours of orbit, ~5 sine cycles. The sparkline
  // shows the satellite's ground-track latitude — north up, south down.
  const series = (history?.prices ?? [])
    .map((p) => Number(p.value))
    .filter((v) => Number.isFinite(v))
    .slice(-48)

  let meta = 'Orbital position · pass times'
  if (live && typeof live.altitude === 'number') {
    meta = `Altitude ${live.altitude.toFixed(1)} km · velocity ${(live.velocity ?? 0).toFixed(0)} km/h`
  }

  const altLabel =
    typeof live?.altitude === 'number' ? `${live.altitude.toFixed(1)} km` : undefined

  return {
    sourceId: 'iss',
    displayName: 'ISS',
    assetName: 'ISS altitude',
    assetValue: altLabel,
    meta,
    coverage: 'anticheat',
    series,
  }
}
