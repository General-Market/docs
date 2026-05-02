import { getIssuerVisionUrl } from '@/lib/config'

/**
 * Proxy for oracle endpoint: GET /vision/explorer/source-stats
 *
 * Per-source lifetime rollup from Postgres:
 *   - last_settled_at:    MAX(vbl.settled_at)
 *   - settled_batches:    COUNT(DISTINCT batch) WHERE settled_at IS NOT NULL
 *   - trader_count:       COUNT(DISTINCT player) over vision_round_players
 *   - total_deposited_wei: SUM(deposited)  — text, 1e18-scaled USDC wei
 *
 * Returns:
 *   { sources: [{ source_id, last_settled_at, settled_batches, trader_count, total_deposited_wei }, ...] }
 */
export async function GET() {
  try {
    const res = await fetch(`${getIssuerVisionUrl()}/vision/explorer/source-stats`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const data = await res.json()
      return Response.json(data, {
        headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=120' },
      })
    }
  } catch {}

  return Response.json({ sources: [] }, { status: 502 })
}
