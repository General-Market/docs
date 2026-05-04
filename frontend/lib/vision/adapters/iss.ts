import type { SourceFeed } from './types'
import { fetchJsonWithTimeout } from './types'

/**
 * ISS — wheretheiss.at exposes an /at endpoint that returns lat/lon/altitude
 * at a single instant. There is no upstream history we trust enough to plot,
 * so the card carries the live altitude as a value chip and leaves the chart
 * empty. A synthesized orbit wave looks beautiful and tells you nothing.
 */

type IssState = {
  altitude?: number
  velocity?: number
  latitude?: number
  longitude?: number
}

const ISS_NORAD_ID = 25544

export async function getIssFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<IssState>(
    `https://api.wheretheiss.at/v1/satellites/${ISS_NORAD_ID}`,
    4000,
  )

  let meta = 'Position · pass times'
  if (data && typeof data.altitude === 'number') {
    meta = `Altitude ${data.altitude.toFixed(1)} km · velocity ${(data.velocity ?? 0).toFixed(0)} km/h`
  }

  const altLabel =
    typeof data?.altitude === 'number' ? `${data.altitude.toFixed(1)} km` : undefined
  return {
    sourceId: 'iss',
    displayName: 'ISS',
    assetName: 'ISS altitude',
    assetValue: altLabel,
    meta,
    coverage: 'anticheat',
    series: [],
  }
}
