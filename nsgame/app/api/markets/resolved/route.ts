// GET /api/markets/resolved — recent resolved markets joined against the
// instantiation row (so the catalog can be back-filled from threshold_bps)
// and the running pool totals (so the row pill renders the actual final
// distribution rather than a 50/50 fallback).
//
// Same Postgres pattern as the other indexer-backed routes — singleton
// pool, graceful empty when POSTGRES_URL is missing, no DB internals
// surfaced to the client.

import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ResolvedRow {
  market: string
  source_id: string
  close_time: string
  settlement_time: string
  threshold_bps: number
  outcome_yes: boolean
  baseline_price: string
  final_price: string
  resolve_block_time: string | null
  total_yes: string
  total_no: string
}

export interface ResolvedMarketDTO {
  market: string
  sourceId: number
  closeTime: number
  settlementTime: number
  thresholdBps: number
  outcomeYes: boolean
  baselinePrice: string
  finalPrice: string
  resolvedAt: number | null
  totalYes: string
  totalNo: string
}

const POOL_KEY = '__nsgame_pg_pool_v1'
declare global {
  // eslint-disable-next-line no-var
  var __nsgame_pg_pool_v1: Pool | undefined
}

function getPool(): Pool | null {
  const url = process.env.POSTGRES_URL
  if (!url) return null
  if (!globalThis[POOL_KEY]) {
    globalThis[POOL_KEY] = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  }
  return globalThis[POOL_KEY] ?? null
}

const SCHEMA = process.env.POSTGRES_SCHEMA || 'prediction_market'

const DEFAULT_LIMIT = 60
const MAX_LIMIT = 200

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const limit = clampLimit(url.searchParams.get('limit'))

  const pool = getPool()
  if (!pool) {
    return NextResponse.json({ markets: [] satisfies ResolvedMarketDTO[] })
  }

  try {
    const sql = `
      WITH pools AS (
        SELECT
          market,
          COALESCE(SUM(amount) FILTER (WHERE side = 0), 0)::text AS total_yes,
          COALESCE(SUM(amount) FILTER (WHERE side = 1), 0)::text AS total_no
        FROM ${SCHEMA}.bet_placed
        GROUP BY market
      )
      SELECT
        mr.market,
        mi.source_id::text       AS source_id,
        mi.close_time::text      AS close_time,
        mi.settlement_time::text AS settlement_time,
        mi.threshold_bps         AS threshold_bps,
        mr.outcome_yes,
        mr.baseline_price::text  AS baseline_price,
        mr.final_price::text     AS final_price,
        mr.block_time::text      AS resolve_block_time,
        COALESCE(p.total_yes, '0') AS total_yes,
        COALESCE(p.total_no,  '0') AS total_no
      FROM ${SCHEMA}.market_resolved mr
      JOIN ${SCHEMA}.market_instantiated mi ON mi.market = mr.market
      LEFT JOIN pools p ON p.market = mr.market
      ORDER BY mr.slot DESC
      LIMIT $1
    `
    const result = await pool.query<ResolvedRow>(sql, [limit])
    const markets: ResolvedMarketDTO[] = result.rows.map(r => ({
      market: r.market,
      sourceId: Number(r.source_id),
      closeTime: Number(r.close_time),
      settlementTime: Number(r.settlement_time),
      thresholdBps: r.threshold_bps,
      outcomeYes: r.outcome_yes,
      baselinePrice: r.baseline_price,
      finalPrice: r.final_price,
      resolvedAt: r.resolve_block_time != null ? Number(r.resolve_block_time) : null,
      totalYes: r.total_yes,
      totalNo: r.total_no,
    }))
    return NextResponse.json({ markets })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/markets/resolved] query failed:', err)
    return NextResponse.json(
      { markets: [] satisfies ResolvedMarketDTO[], error: 'query_failed' },
      { status: 500 },
    )
  }
}
