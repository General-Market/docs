// Sources we've announced on the homepage but haven't yet wired into the
// data-node / vault stack. They render as normal cards on the home grid;
// their /source route shows a quiet "we're building this" placeholder
// instead of 404'ing.
//
// When a source goes live (gets a vault entry in fund-branding.json and
// a registry entry from the data-node), remove its ID from here.

export type EarlyAccessSource = {
  id: string
  displayName: string
  meta: string
  assetName: string
}

export const EARLY_ACCESS_SOURCES: EarlyAccessSource[] = [
  {
    id: '4chan',
    displayName: '4chan',
    meta: 'Boards · post velocity · thread heat',
    assetName: '/biz/ posts per hour',
  },
  {
    id: 'rust',
    displayName: 'Rust',
    meta: 'crates.io · downloads · releases',
    assetName: 'tokio downloads · 24h',
  },
  {
    id: 'binance-options',
    displayName: 'Binance Options',
    meta: 'BTC · ETH · open interest',
    assetName: 'BTC option open interest',
  },
  {
    id: 'binance-funding',
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
]

const EARLY_ACCESS_MAP = new Map(EARLY_ACCESS_SOURCES.map((s) => [s.id, s]))

export function isEarlyAccessSource(sourceId: string | undefined | null): boolean {
  if (!sourceId) return false
  return EARLY_ACCESS_MAP.has(sourceId)
}

export function getEarlyAccessSource(
  sourceId: string | undefined | null,
): EarlyAccessSource | undefined {
  if (!sourceId) return undefined
  return EARLY_ACCESS_MAP.get(sourceId)
}

/**
 * Deterministic, seeded sparkline shape for early-access sources.
 * Same input → same series, so SSR matches CSR and each card has its
 * own silhouette without storing one.
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
