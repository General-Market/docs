import { NextResponse } from 'next/server'
import { getAaDataNodeUrl, getIssuerVisionUrl } from '@/lib/config'
import sourcesDisplay from '@/data/sources-display.json'

/**
 * Aggregate Vision-only stats for the top bar: total live markets and total
 * settled rounds. Excludes ITP data on purpose — the topbar reads *Vision*,
 * not the combined data-node symbol count which also includes ITP baskets.
 *
 * - Total markets: data-node `/market/stats`. Prefers the top-level
 *   `totalAssets` field; falls back to summing per-source `totalAssets`
 *   in case an older data-node build omits the aggregate.
 * - Total settlements: sum of per-source `history?per_page=1` totalSettled
 *   across every source in sources-display.json. The oracle paginates per
 *   source, so the only way to get a global count is N small calls. Cached
 *   60s on the CDN so the fan-out runs at most once per minute.
 *
 * Both values are returned as `number | null`. `null` means "fetch failed —
 * don't display anything" (topbar hides the segment). Zero is a real
 * answer and renders as "0".
 */
export async function GET() {
  const issuerBase = getIssuerVisionUrl()
  const dataNodeBase = getAaDataNodeUrl()

  // ── Total Vision markets ──────────────────────────────────────────────
  let totalMarkets: number | null = null
  try {
    const res = await fetch(`${dataNodeBase}/market/stats`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const data = await res.json()
      const topLevel = Number(data?.totalAssets)
      if (Number.isFinite(topLevel) && topLevel > 0) {
        totalMarkets = topLevel
      } else if (data?.sources && typeof data.sources === 'object') {
        // Fallback: older data-node builds only expose per-source stats.
        let sum = 0
        for (const src of Object.values(data.sources) as Array<Record<string, unknown>>) {
          const n = Number(src?.totalAssets)
          if (Number.isFinite(n)) sum += n
        }
        totalMarkets = sum
      }
    }
  } catch {
    // leave as null — topbar hides the markets segment
  }

  // ── Total settled rounds across all sources ───────────────────────────
  const sourceIds: string[] = (sourcesDisplay as { sources: Array<{ sourceId: string }> }).sources.map(
    (s) => s.sourceId,
  )

  let settledFetchFailed = 0
  const settledCounts = await Promise.all(
    sourceIds.map(async (sid) => {
      try {
        const res = await fetch(
          `${issuerBase}/vision/source/${encodeURIComponent(sid)}/history?page=1&per_page=1`,
          { signal: AbortSignal.timeout(5_000) },
        )
        if (!res.ok) {
          settledFetchFailed++
          return 0
        }
        const data = await res.json()
        return Number(data.totalSettled ?? 0)
      } catch {
        settledFetchFailed++
        return 0
      }
    }),
  )

  // If every single source failed, treat settlements as unknown (null) rather
  // than a misleading zero. Partial failures still sum what we have.
  const totalSettled: number | null =
    settledFetchFailed === sourceIds.length
      ? null
      : settledCounts.reduce((a, b) => a + b, 0)

  const response = NextResponse.json({ totalMarkets, totalSettled })
  response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=180')
  return response
}
