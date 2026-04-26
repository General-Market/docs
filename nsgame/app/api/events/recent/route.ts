// GET /api/events/recent
//
// Most recent 50 bet_placed rows across all markets. Joins the latest
// market_instantiated per market so the UI can render the source + the
// threshold without a second round-trip.

import { NextRequest } from 'next/server'
import { query } from '@/lib/indexer/pg'
import type { BetPlacedRow } from '@/lib/indexer/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

interface RawRow {
  signature: string
  slot: string
  block_time: string | null
  market: string
  owner: string
  side: number
  amount: string
  source_id: number | null
  threshold_bps: number | null
  close_time: string | null
  settlement_time: string | null
  creator: string | null
  total_yes: string | null
  total_no: string | null
  resolved: boolean | null
  outcome_yes: boolean | null
  final_price: string | null
  baseline_price: string | null
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const raw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(raw)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.trunc(raw)))
    : DEFAULT_LIMIT

  try {
    // Pools are summed across every bet on the market — the indexer
    // outlives the on-chain account (cams settle in two minutes and the
    // PDA is closed) so this is the only source that survives long
    // enough to show a multiplier in the ticker.
    const sql = `
      SELECT
        bp.signature,
        bp.slot::text       AS slot,
        bp.block_time::text AS block_time,
        bp.market, bp.owner, bp.side,
        bp.amount::text     AS amount,
        mi.source_id, mi.threshold_bps,
        mi.close_time::text      AS close_time,
        mi.settlement_time::text AS settlement_time,
        mi.creator,
        pools.total_yes::text    AS total_yes,
        pools.total_no::text     AS total_no,
        (mr.market IS NOT NULL)  AS resolved,
        mr.outcome_yes           AS outcome_yes,
        mr.final_price::text     AS final_price,
        mr.baseline_price::text  AS baseline_price
      FROM __SCHEMA__.bet_placed bp
      LEFT JOIN LATERAL (
        SELECT source_id, threshold_bps, close_time, settlement_time, creator
        FROM __SCHEMA__.market_instantiated
        WHERE market = bp.market
        ORDER BY slot DESC LIMIT 1
      ) mi ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(CASE WHEN side = 0 THEN amount ELSE 0 END), 0) AS total_yes,
          COALESCE(SUM(CASE WHEN side = 1 THEN amount ELSE 0 END), 0) AS total_no
          FROM __SCHEMA__.bet_placed
         WHERE market = bp.market
      ) pools ON TRUE
      LEFT JOIN __SCHEMA__.market_resolved mr ON mr.market = bp.market
      ORDER BY bp.slot DESC, bp.signature
      LIMIT $1
    `
    const rows = await query<RawRow>(sql, [limit])
    const events: BetPlacedRow[] = rows.map((r): BetPlacedRow => ({
      type: 'BetPlaced',
      signature: r.signature,
      slot: r.slot,
      blockTime: r.block_time,
      market: r.market,
      owner: r.owner,
      side: (r.side ?? 0) as 0 | 1,
      amount: r.amount ?? '0',
      marketMeta: {
        market: r.market,
        sourceId: r.source_id,
        thresholdBps: r.threshold_bps,
        closeTime: r.close_time,
        settlementTime: r.settlement_time,
        creator: r.creator,
        resolved: r.resolved === true,
        outcomeYes: r.outcome_yes,
        finalPrice: r.final_price,
        baselinePrice: r.baseline_price,
        forceResolved: null,
        totalYes: r.total_yes,
        totalNo: r.total_no,
      },
    }))
    return Response.json({ events })
  } catch (err) {
    console.error('[events/recent] query failed', err)
    return Response.json({ error: 'query failed' }, { status: 500 })
  }
}
