// GET /api/positions/[wallet] — every bet the wallet ever placed, joined
// against close, resolve, and claim events so the frontend can derive a
// state for each position without a second round-trip.
//
// Same Postgres pattern as /api/markets/[pda]/bets — singleton pool guarded
// by a global, graceful empty when POSTGRES_URL is missing. Dev machines
// without a tunnel keep rendering.

import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PositionRow {
  market: string
  source_id: string | null
  close_time: string | null
  settlement_time: string | null
  threshold_bps: number | null
  bet_sig: string
  side: 0 | 1
  amount: string
  bet_slot: string
  bet_ts: string | null
  close_baseline: string | null
  close_sig: string | null
  final_price: string | null
  outcome_yes: boolean | null
  resolve_sig: string | null
  claim_net: string | null
  claim_fee: string | null
  claim_stranded: boolean | null
  claim_sig: string | null
}

export type PositionState =
  | 'open'
  | 'settling'
  | 'resolved-won'
  | 'resolved-lost'
  | 'claimed-won'
  | 'claimed-lost'
  | 'stranded-refund'

export interface UserPositionDTO {
  market: string
  sourceId: number
  closeTime: number
  settlementTime: number
  thresholdBps: number
  side: 'yes' | 'no'
  amount: string
  state: PositionState
  baselinePrice: string | null
  finalPrice: string | null
  claimNet: string | null
  claimFee: string | null
  claimSig: string | null
  betSig: string
  betSlot: string
  betTs: number | null
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

// Solana pubkeys are 32-byte ed25519 points, base58 encoded into 32–44
// characters. We don't decode; the SQL is parameterised.
function isPlausibleWallet(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)
}

function deriveState(row: PositionRow, nowSecs: number): PositionState {
  // The order matters. Walk from the most-resolved end backwards: if a
  // claim row exists, we're done — partition on stranded vs net. Otherwise
  // a resolve row decides won/lost. Otherwise a close row means settling.
  // Default: open.
  if (row.claim_sig) {
    if (row.claim_stranded) return 'stranded-refund'
    const net = row.claim_net ? BigInt(row.claim_net) : 0n
    return net > 0n ? 'claimed-won' : 'claimed-lost'
  }
  if (row.resolve_sig && row.outcome_yes !== null) {
    const userYes = row.side === 0
    return row.outcome_yes === userYes ? 'resolved-won' : 'resolved-lost'
  }
  if (row.close_sig) return 'settling'
  // No close row yet. If close_time is in the past, the oracle simply
  // hasn't caught up — still treat as settling so the UI shows the right
  // affordance.
  if (row.close_time !== null && Number(row.close_time) <= nowSecs) {
    return 'settling'
  }
  return 'open'
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ wallet: string }> },
): Promise<NextResponse> {
  const { wallet } = await ctx.params

  if (!isPlausibleWallet(wallet)) {
    return NextResponse.json({ positions: [] satisfies UserPositionDTO[] }, { status: 400 })
  }

  const pool = getPool()
  if (!pool) {
    return NextResponse.json({ positions: [] satisfies UserPositionDTO[] })
  }

  // Optional filters for cranker bots and pagination. `unclaimed=1` returns
  // only resolved-but-not-claimed rows so a claimer doesn't have to walk
  // the entire tape. limit/offset honour explicit pagination instead of
  // the implicit 100-row cap.
  const { searchParams } = new URL(req.url)
  const unclaimedOnly = searchParams.get('unclaimed') === '1'
  const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const offsetRaw = Number.parseInt(searchParams.get('offset') ?? '', 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(limitRaw, 1000)
    : 100
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0

  try {
    const filterClause = unclaimedOnly
      ? 'AND mr.market IS NOT NULL AND c.signature IS NULL'
      : ''
    const sql = `
      SELECT
        bp.market,
        mi.source_id::text       AS source_id,
        mi.close_time::text      AS close_time,
        mi.settlement_time::text AS settlement_time,
        mi.threshold_bps         AS threshold_bps,
        bp.signature             AS bet_sig,
        bp.side,
        bp.amount::text          AS amount,
        bp.slot::text            AS bet_slot,
        bp.block_time::text      AS bet_ts,
        mc.baseline_price::text  AS close_baseline,
        mc.signature             AS close_sig,
        mr.final_price::text     AS final_price,
        mr.outcome_yes,
        mr.signature             AS resolve_sig,
        c.net::text              AS claim_net,
        c.fee::text              AS claim_fee,
        c.stranded               AS claim_stranded,
        c.signature              AS claim_sig
      FROM ${SCHEMA}.bet_placed bp
      LEFT JOIN ${SCHEMA}.market_instantiated mi ON mi.market = bp.market
      LEFT JOIN ${SCHEMA}.market_closed mc       ON mc.market = bp.market
      LEFT JOIN ${SCHEMA}.market_resolved mr     ON mr.market = bp.market
      LEFT JOIN ${SCHEMA}.claimed c              ON c.market  = bp.market AND c.owner = bp.owner
      WHERE bp.owner = $1
        ${filterClause}
      ORDER BY bp.slot DESC
      LIMIT $2 OFFSET $3
    `
    const result = await pool.query<PositionRow>(sql, [wallet, limit, offset])
    const nowSecs = Math.floor(Date.now() / 1000)
    const positions: UserPositionDTO[] = result.rows.map(r => ({
      market: r.market,
      sourceId: r.source_id != null ? Number(r.source_id) : 0,
      closeTime: r.close_time != null ? Number(r.close_time) : 0,
      settlementTime: r.settlement_time != null ? Number(r.settlement_time) : 0,
      thresholdBps: r.threshold_bps ?? 0,
      side: r.side === 0 ? 'yes' : 'no',
      amount: r.amount,
      state: deriveState(r, nowSecs),
      baselinePrice: r.close_baseline,
      finalPrice: r.final_price,
      claimNet: r.claim_net,
      claimFee: r.claim_fee,
      claimSig: r.claim_sig,
      betSig: r.bet_sig,
      betSlot: r.bet_slot,
      betTs: r.bet_ts != null ? Number(r.bet_ts) : null,
    }))
    return NextResponse.json({ positions })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/positions] query failed:', err)
    return NextResponse.json(
      { positions: [] satisfies UserPositionDTO[], error: 'query_failed' },
      { status: 500 },
    )
  }
}
