// The "More sources" row on the homepage. These IDs match the data-node
// registry exactly (see frontend/data/sources-display.json). Each routes
// to its real /source/<id> page — no placeholder, no fallback.
//
// To add a source: drop a new entry here. To retire one: delete the entry.

export type FeaturedSource = {
  id: string
  displayName: string
  meta: string
  assetName: string
}

export const FEATURED_SOURCES: FeaturedSource[] = [
  {
    id: 'fourchan',
    displayName: '4chan',
    meta: 'Boards · post velocity · thread heat',
    assetName: '/biz/ posts per hour',
  },
  {
    id: 'crates_io',
    displayName: 'Rust',
    meta: 'crates.io · downloads · releases',
    assetName: 'tokio downloads · 24h',
  },
  {
    id: 'binance_options',
    displayName: 'Binance Options',
    meta: 'BTC · ETH · open interest',
    assetName: 'BTC option open interest',
  },
  {
    id: 'binance_futures_funding',
    displayName: 'Binance Funding',
    meta: 'Perp funding rate · 8h',
    assetName: 'BTC perp funding rate',
  },
  {
    id: 'cloudflare',
    displayName: 'Cloudflare',
    meta: 'Radar · global traffic · outages',
    assetName: 'Worldwide traffic index',
  },
  {
    id: 'db_trains',
    displayName: 'Deutsche Bahn',
    meta: 'Long-distance · delays · cancellations',
    assetName: 'ICE delay rate · today',
  },
  {
    id: 'airnow',
    displayName: 'AirNow',
    meta: 'EPA · air quality index · USA',
    assetName: 'PM2.5 · national average',
  },
  {
    id: 'animals',
    displayName: 'Wildlife',
    meta: 'iNaturalist · species sightings · 24h',
    assetName: 'Observations · worldwide',
  },
]

/**
 * Deterministic seeded sparkline. Same input → same series, so SSR and
 * CSR agree and each card carries its own silhouette without us having
 * to thread a real time series through the homepage SSR path.
 */
export function seededSeries(seed: string, count = 24): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return (h & 0xffff) / 0xffff
  }
  const series: number[] = []
  let v = 50 + rand() * 20
  for (let i = 0; i < count; i++) {
    v += (rand() - 0.5) * 12
    series.push(v)
  }
  return series
}
