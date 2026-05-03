// Shared shape for source adapters that produce a stationary 24h sparkline.
// All adapters MUST be safely callable from server components and route handlers.
// Failure mode: return a synthetic flat-ish series (not throw) so the home grid
// never has empty tiles. The card pill carries the honesty: 'soon' or 'external'
// when the data isn't real.

export type Coverage = 'anticheat' | 'external' | 'soon'

export interface SourceFeed {
  sourceId: string
  displayName: string
  /** Specific sub-market label drawn over the chart (e.g. "BTC by Dec 31", "CS2", "bitcoin/bitcoin"). */
  assetName?: string
  /** Number printed alongside the assetName on the chart (price, count, percentage). */
  assetValue?: string
  meta: string
  coverage: Coverage
  series: number[]
  /** Photo thumbnail URL (e.g. /source-imgs/crop-polymarket.webp). YouTube-style. */
  imageUrl?: string
  hrefOverride?: string
  /** Set when the adapter wants to bypass /source/[id] (typically for external/soon). */
  external?: boolean
}

/** Default landscape banner per known sourceId — `new-*` are designed promotional banners. */
export const SOURCE_IMAGES: Record<string, string> = {
  polymarket: '/source-imgs/new-polymarket.webp',
  pumpfun: '/source-imgs/new-pumpfun.webp',
  defillama: '/source-imgs/new-defillama.webp',
  equities: '/source-imgs/grab-nasdaq.webp',
  espn: '/source-imgs/grab-espn.webp',
  twitch: '/source-imgs/new-twitch.webp',
  steam: '/source-imgs/new-steam.webp',
  github: '/source-imgs/new-github.webp',
  iss: '/source-imgs/new-iss.webp',
}

export interface AdapterContext {
  /** Number of points in the returned series. Default 48. */
  resolution?: number
  /** Force-disable network calls (for tests / build-time). */
  offline?: boolean
}

export const DEFAULT_RESOLUTION = 48

/**
 * Deterministic pseudo-random walk series — fallback when an adapter fails.
 * Geometric Brownian motion: each step adds a small drift + noise to the
 * previous value, like real market data instead of a sawtooth sine wave.
 *
 * Seeded by sourceId so the same source always produces the same shape.
 */
export function fallbackSeries(
  sourceId: string,
  n = DEFAULT_RESOLUTION,
  mean = 1,
  // Legacy callers passed amplitude/frequency in slots 4 and 5. Treat any value
  // ≥ 0.5 as a legacy amplitude and clamp to a safe volatility.
  rawVol = 0.018,
  // Drift parameter is unused by external callers — derived from mean.
  _legacyFreq = 0,
): number[] {
  void _legacyFreq
  const volatility = rawVol >= 0.5 ? Math.min(0.04, rawVol / 100) : rawVol
  const drift = 0.001
  let seed = 0
  for (let i = 0; i < sourceId.length; i++) seed = (seed * 31 + sourceId.charCodeAt(i)) >>> 0
  const driftSign = (seed & 1) === 0 ? 1 : -1
  let v = mean
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const u = ((seed >>> 8) & 0xffff) / 0xffff
    seed = (seed * 1664525 + 1013904223) >>> 0
    const u2 = ((seed >>> 8) & 0xffff) / 0xffff
    const z = Math.sqrt(-2 * Math.log(Math.max(1e-9, u))) * Math.cos(2 * Math.PI * u2)
    v = v + driftSign * drift * mean + z * volatility * v
    // Clamp to a sane multiple of mean so a single tail event can't blow up the chart.
    const lo = mean * 0.5
    const hi = mean * 1.6
    if (v < lo) v = lo + (lo - v) * 0.2
    if (v > hi) v = hi - (v - hi) * 0.2
    out.push(v)
  }
  return out
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  ms = 4000,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), ms)
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      next: { revalidate: 600 },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}
