// GET /api/activity?limit=N — a network-wide event feed across every
// market the indexer has seen. Mixes bets, resolutions, and claims into
// one slot-ordered stream so the right rail has a heartbeat even before
// the connected wallet has any history of its own.
//
// Same singleton pg-pool pattern as /api/positions/[wallet]: graceful
// empty when POSTGRES_URL is missing (dev machines without a tunnel
// keep rendering), parameterised SQL, no surprises.

import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type ActivityKind = 'bet' | 'resolved' | 'claim'

export interface ActivityEventDTO {
  kind: ActivityKind
  signature: string
  slot: string
  blockTime: number | null
  market: string
  pairIndex: number | null
  owner: string | null
  // Bet-only:
  side?: 'yes' | 'no'
  amount?: string
  // Resolved-only:
  outcomeYes?: boolean
  finalPrice?: string
  // Claim-only:
  net?: string
  stranded?: boolean
}

interface UnifiedRow {
  kind: ActivityKind
  signature: string
  slot: string
  block_time: string | null
  market: string
  owner: string | null
  detail_a: string | null
  detail_b: string | null
  detail_c: string | null
  pair_index: number | null
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

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT
  return Math.min(Math.max(n, 1), MAX_LIMIT)
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const limit = clampLimit(searchParams.get('limit'))

  const pool = getPool()
  if (!pool) {
    return NextResponse.json({ events: [] satisfies ActivityEventDTO[] })
  }

  try {
    // The three SELECTs must agree on column count and types, hence the
    // NULL-padding. detail_a/b/c carry kind-specific scalars cast to
    // text — the route reshapes them per-kind in the loop below.
    const sql = `
      WITH unified AS (
        SELECT 'bet'::text     AS kind,
               signature,
               slot,
               block_time,
               market,
               owner,
               side::text       AS detail_a,
               amount::text     AS detail_b,
               NULL::text       AS detail_c
          FROM ${SCHEMA}.bet_placed
        UNION ALL
        SELECT 'resolved'::text,
               signature,
               slot,
               block_time,
               market,
               NULL::text       AS owner,
               outcome_yes::text AS detail_a,
               final_price::text AS detail_b,
               NULL::text       AS detail_c
          FROM ${SCHEMA}.market_resolved
        UNION ALL
        SELECT 'claim'::text,
               signature,
               slot,
               block_time,
               market,
               owner,
               net::text        AS detail_a,
               stranded::text   AS detail_b,
               NULL::text       AS detail_c
          FROM ${SCHEMA}.claimed
      )
      SELECT u.kind,
             u.signature,
             u.slot::text         AS slot,
             u.block_time::text   AS block_time,
             u.market,
             u.owner,
             u.detail_a,
             u.detail_b,
             u.detail_c,
             mi.threshold_bps     AS pair_index
        FROM unified u
        LEFT JOIN ${SCHEMA}.market_instantiated mi USING (market)
       ORDER BY u.slot DESC
       LIMIT $1
    `
    const result = await pool.query<UnifiedRow>(sql, [limit])
    const events: ActivityEventDTO[] = result.rows.map(r => {
      const base = {
        signature: r.signature,
        slot: r.slot,
        blockTime: r.block_time != null ? Number(r.block_time) : null,
        market: r.market,
        pairIndex: r.pair_index,
        owner: r.owner,
      }
      if (r.kind === 'bet') {
        return {
          kind: 'bet' as const,
          ...base,
          side: r.detail_a === '0' ? 'yes' : 'no',
          amount: r.detail_b ?? '0',
        }
      }
      if (r.kind === 'resolved') {
        return {
          kind: 'resolved' as const,
          ...base,
          outcomeYes: r.detail_a === 'true' || r.detail_a === 't',
          finalPrice: r.detail_b ?? '0',
        }
      }
      return {
        kind: 'claim' as const,
        ...base,
        net: r.detail_a ?? '0',
        stranded: r.detail_b === 'true' || r.detail_b === 't',
      }
    })
    return NextResponse.json({ events })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/activity] query failed:', err)
    return NextResponse.json(
      { events: [] satisfies ActivityEventDTO[], error: 'query_failed' },
      { status: 500 },
    )
  }
}
