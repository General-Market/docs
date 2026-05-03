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
  hrefOverride?: string
  /** Set when the adapter wants to bypass /source/[id] (typically for external/soon). */
  external?: boolean
}

export interface AdapterContext {
  /** Number of points in the returned series. Default 48. */
  resolution?: number
  /** Force-disable network calls (for tests / build-time). */
  offline?: boolean
}

export const DEFAULT_RESOLUTION = 48

/**
 * Stable pseudo-random series — used as a fallback when an adapter fails or runs
 * in offline mode. Deterministic per sourceId so the static render stays stable.
 */
export function fallbackSeries(sourceId: string, n = DEFAULT_RESOLUTION, mean = 0.5, ampl = 6, freq = 5): number[] {
  let seed = 0
  for (let i = 0; i < sourceId.length; i++) seed = (seed * 31 + sourceId.charCodeAt(i)) >>> 0
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * Math.PI * 2 * freq
    seed = (seed * 1664525 + 1013904223) >>> 0
    const noise = ((seed >>> 8) & 0xffff) / 0xffff - 0.5
    out.push(mean + Math.sin(t) * ampl + noise * (ampl * 0.25))
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
