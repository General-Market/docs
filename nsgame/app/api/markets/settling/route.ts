// GET /api/markets/settling — markets whose close window has passed but
// the keeper has not yet paid out. The intermediate purgatory between
// `live` (still accepting bets) and `resolved` (final price recorded).
//
// Query: rows in `market_instantiated` with `close_time <= now` and no
// matching `market_resolved` row. Joined to per-market pool totals so the
// row pill renders the actual distribution rather than a 50/50 fallback.
//
// Same Postgres pattern as the resolved route — singleton pool, graceful
// empty when POSTGRES_URL is missing, no DB internals surfaced to the
// client.

import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SettlingRow {
  market: string
  source_id: string
  close_time: string
  settlement_time: string
  threshold_bps: number
  total_yes: string
  total_no: string
}

export interface SettlingMarketDTO {
  market: string
  sourceId: number
  closeTime: number
  settlementTime: number
  thresholdBps: number
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
  const nowSecs = Math.floor(Date.now() / 1000)

  const pool = getPool()
  if (!pool) {
    return NextResponse.json({ markets: [] satisfies SettlingMarketDTO[] })
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
        mi.market,
        mi.source_id::text       AS source_id,
        mi.close_time::text      AS close_time,
        mi.settlement_time::text AS settlement_time,
        mi.threshold_bps         AS threshold_bps,
        COALESCE(p.total_yes, '0') AS total_yes,
        COALESCE(p.total_no,  '0') AS total_no
      FROM ${SCHEMA}.market_instantiated mi
      LEFT JOIN ${SCHEMA}.market_resolved mr ON mr.market = mi.market
      LEFT JOIN pools p ON p.market = mi.market
      WHERE mr.market IS NULL
        AND mi.close_time <= $2
      ORDER BY mi.close_time DESC
      LIMIT $1
    `
    const result = await pool.query<SettlingRow>(sql, [limit, nowSecs])
    const markets: SettlingMarketDTO[] = result.rows.map(r => ({
      market: r.market,
      sourceId: Number(r.source_id),
      closeTime: Number(r.close_time),
      settlementTime: Number(r.settlement_time),
      thresholdBps: r.threshold_bps,
      totalYes: r.total_yes,
      totalNo: r.total_no,
    }))
    return NextResponse.json({ markets })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/markets/settling] query failed:', err)
    return NextResponse.json(
      { markets: [] satisfies SettlingMarketDTO[], error: 'query_failed' },
      { status: 500 },
    )
  }
}
