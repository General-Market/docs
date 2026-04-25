// GET /api/markets/[pda]/bets — recent BetPlaced events for a market PDA.
//
// The indexer Postgres lives on VPS 3, bound to 127.0.0.1. For local dev
// the developer opens an SSH tunnel and points POSTGRES_URL at the
// forwarded port. If the env var is unset, we return an empty array — the
// UI keeps working for contributors without VPS access.

import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface BetRow {
  signature: string
  owner: string
  side: 0 | 1
  amount: string
  slot: string
  block_time: string | null
}

export interface RecentBetDTO {
  signature: string
  owner: string
  side: 'yes' | 'no'
  amount: string
  slot: string
  blockTime: number | null
}

// Singleton pool keyed by URL — Next.js route handlers re-evaluate on
// hot-reload; without the global guard we'd leak connections in dev.
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

// Minimal validation. PDAs are 32-byte ed25519 points encoded as base58 —
// 32–44 chars from the base58 alphabet. We don't try to parse them; the
// query is parameterised, and a non-PDA simply matches nothing.
function isPlausiblePda(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ pda: string }> },
): Promise<NextResponse> {
  const { pda } = await ctx.params

  if (!isPlausiblePda(pda)) {
    return NextResponse.json({ bets: [] satisfies RecentBetDTO[] })
  }

  const pool = getPool()
  if (!pool) {
    // POSTGRES_URL unset. Graceful empty response — UI still renders.
    return NextResponse.json({ bets: [] satisfies RecentBetDTO[] })
  }

  try {
    const sql = `
      SELECT signature, owner, side, amount::text AS amount,
             slot::text AS slot, block_time::text AS block_time
      FROM ${SCHEMA}.bet_placed
      WHERE market = $1
      ORDER BY slot DESC
      LIMIT 20
    `
    const result = await pool.query<BetRow>(sql, [pda])
    const bets: RecentBetDTO[] = result.rows.map(r => ({
      signature: r.signature,
      owner: r.owner,
      side: r.side === 0 ? 'yes' : 'no',
      amount: r.amount,
      slot: r.slot,
      blockTime: r.block_time != null ? Number(r.block_time) : null,
    }))
    return NextResponse.json({ bets })
  } catch (err) {
    // Don't leak DB internals to the client. Log server-side, return empty.
    // eslint-disable-next-line no-console
    console.error('[api/markets/bets] query failed:', err)
    return NextResponse.json({ bets: [] satisfies RecentBetDTO[], error: 'query_failed' }, { status: 500 })
  }
}
