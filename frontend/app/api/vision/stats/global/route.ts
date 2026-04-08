import { NextResponse } from 'next/server'
import { getAaDataNodeUrl, getIssuerVisionUrl } from '@/lib/config'

/**
 * Aggregate Vision-only stats for the top bar: total live markets and total
 * lifetime settlements. Excludes ITP data on purpose — the topbar reads
 * *Vision*, not the combined data-node symbol count.
 *
 * - Total markets: data-node `/market/stats`. Prefers the top-level
 *   `totalAssets`; falls back to summing per-source `totalAssets` for
 *   older data-node builds.
 * - Total settlements: issuer `/vision/stats/global`, which returns
 *   `SUM(market_count)` across every settled `vision_batch_lifecycle` row.
 *   A "settlement" here is a single market reaching resolution — one
 *   settled batch of 2559 markets counts as 2559 settlements.
 *
 * Both values are returned as `number | null`. `null` means the fetch
 * failed; the topbar hides that segment. Zero is a real answer and
 * renders as "0". Cached 60s on the CDN.
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

  // ── Total lifetime settlements ───────────────────────────────────────
  let totalSettled: number | null = null
  try {
    const res = await fetch(`${issuerBase}/vision/stats/global`, {
      signal: AbortSignal.timeout(8_000),
    })
    if (res.ok) {
      const data = await res.json()
      const n = Number(data?.totalSettlements)
      if (Number.isFinite(n) && n >= 0) {
        totalSettled = n
      }
    }
  } catch {
    // leave as null — topbar hides the settlements segment
  }

  const response = NextResponse.json({ totalMarkets, totalSettled })
  response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=180')
  return response
}
