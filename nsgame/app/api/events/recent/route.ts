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
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const raw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(raw)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.trunc(raw)))
    : DEFAULT_LIMIT

  try {
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
        mi.creator
      FROM __SCHEMA__.bet_placed bp
      LEFT JOIN LATERAL (
        SELECT source_id, threshold_bps, close_time, settlement_time, creator
        FROM __SCHEMA__.market_instantiated
        WHERE market = bp.market
        ORDER BY slot DESC LIMIT 1
      ) mi ON TRUE
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
        resolved: false,
        outcomeYes: null,
        finalPrice: null,
        baselinePrice: null,
        forceResolved: null,
      },
    }))
    return Response.json({ events })
  } catch (err) {
    console.error('[events/recent] query failed', err)
    return Response.json({ error: 'query failed' }, { status: 500 })
  }
}
