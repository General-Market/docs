import { getIssuerVisionUrl } from '@/lib/config'

/**
 * Proxy for oracle endpoint: GET /vision/explorer/tie-rate-history
 *
 * Oracle SQL (Postgres — vision_round_players + vision_batch_lifecycle):
 *
 *   SELECT
 *       date_trunc('hour', created_at) as hour,
 *       source_id,
 *       COUNT(*) as total_rounds,
 *       SUM(CASE WHEN is_tie THEN 1 ELSE 0 END) as ties
 *   FROM (
 *       SELECT vrp.batch_id, vbl.source_id, vbl.created_at,
 *              BOOL_AND(vrp.pnl::numeric = 0) as is_tie
 *       FROM vision_round_players vrp
 *       LEFT JOIN vision_batch_lifecycle vbl ON vrp.batch_id = vbl.batch_id
 *       GROUP BY vrp.batch_id, vbl.source_id, vbl.created_at
 *       HAVING COUNT(DISTINCT vrp.player) > 1
 *   ) sub
 *   GROUP BY 1, 2
 *   ORDER BY 1
 *
 * Expected response shape:
 *   {
 *     history: [
 *       { hour: "2026-03-27T14:00:00Z", source_id: "twitch", total_rounds: 12, ties: 3 },
 *       { hour: "2026-03-27T14:00:00Z", source_id: "defi", total_rounds: 8, ties: 1 },
 *       ...
 *     ]
 *   }
 */
export async function GET() {
  try {
    const res = await fetch(`${getIssuerVisionUrl()}/vision/explorer/tie-rate-history`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) return Response.json(await res.json())
  } catch {}

  // Fallback: empty until oracle endpoint is deployed
  return Response.json({ history: [] })
}
