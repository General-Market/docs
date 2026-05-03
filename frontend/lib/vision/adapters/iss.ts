import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries, fetchJsonWithTimeout } from './types'

/**
 * ISS — wheretheiss.at exposes an /at endpoint that returns lat/lon/altitude.
 * Single point only; we synthesize the stationary curve from altitude (which is
 * stable around ~420km but oscillates per orbit) padded with a fallback wave.
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

  let series: number[]
  let meta = 'Position · pass times'

  if (data && typeof data.altitude === 'number') {
    const alt = data.altitude
    const lat = data.latitude ?? 0
    series = orbitWave(DEFAULT_RESOLUTION, alt, lat)
    meta = `Altitude ${alt.toFixed(1)} km · velocity ${(data.velocity ?? 0).toFixed(0)} km/h`
  } else {
    series = fallbackSeries('iss', DEFAULT_RESOLUTION, 420, 8, 1.6)
  }

  return {
    sourceId: 'iss',
    displayName: 'ISS',
    meta,
    coverage: 'anticheat',
    series,
  }
}

function orbitWave(n: number, alt: number, latPhase: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const phase = (i / (n - 1)) * Math.PI * 2 * 1.6 + (latPhase * Math.PI) / 90
    out.push(alt + Math.sin(phase) * 6)
  }
  return out
}
