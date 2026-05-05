// Shared shape for source adapters that produce a 24h sparkline.
// All adapters MUST be safely callable from server components and route handlers.
// Failure mode: return `series: []`. The Sparkline renders nothing for empty
// data — Apple's rule, real or absent. No GBM, no sine waves, no synthesized
// activity curves. The card carries weight on its own.

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
  sports: '/source-imgs/grab-espn.webp',
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
