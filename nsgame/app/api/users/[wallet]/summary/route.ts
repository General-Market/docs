// GET /api/users/[wallet]/summary — header stats and a daily PnL series
// for the profile page.
//
// Same singleton-pool pattern as /api/positions/[wallet]. Lifetime PnL,
// volume, win rate, joined date, and a 30-day daily realized-PnL series
// for the sparkline.
//
// PnL math mirrors the leaderboard route — realized only. We do not
// invent unrealized PnL.

import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface UserPnlPoint {
  /** Day in unix seconds at 00:00 UTC. */
  ts: number
  /** Realized PnL on that day, 6-decimal USDC string, signed. */
  pnl: string
}

export interface UserSummaryDTO {
  wallet: string
  /** First bet's block_time. Unix seconds, or null if never bet. */
  joinedAt: number | null
  /** Lifetime stake summed across every bet. 6-decimal USDC string. */
  volume: string
  /** Lifetime realized PnL. 6-decimal USDC string, signed. */
  pnlRealized: string
  /** Stake locked in unresolved markets. 6-decimal USDC string. */
  stakeAtRisk: string
  betsCount: number
  resolvedCount: number
  winCount: number
  /** 0..1, or null if no resolved positions. */
  winRate: number | null
  /** Last 30 daily PnL points, oldest first. Empty if no fills. */
  pnlSeries: UserPnlPoint[]
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

function isPlausibleWallet(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)
}

function safeBig(v: string | null | undefined): bigint {
  if (v == null) return 0n
  try { return BigInt(v) } catch { return 0n }
}

function emptySummary(wallet: string): UserSummaryDTO {
  return {
    wallet,
    joinedAt: null,
    volume: '0',
    pnlRealized: '0',
    stakeAtRisk: '0',
    betsCount: 0,
    resolvedCount: 0,
    winCount: 0,
    winRate: null,
    pnlSeries: [],
  }
}

interface SummaryRow {
  joined_at: string | null
  volume: string
  pnl_claims: string
  resolved_stake: string
  stake_at_risk: string
  bets_count: string
  resolved_count: string
  win_count: string
}

interface SeriesRow {
  day: string
  pnl: string
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ wallet: string }> },
): Promise<NextResponse> {
  const { wallet } = await ctx.params

  if (!isPlausibleWallet(wallet)) {
    return NextResponse.json(emptySummary(wallet), { status: 400 })
  }

  const pool = getPool()
  if (!pool) {
    return NextResponse.json(emptySummary(wallet))
  }

  try {
    // Header stats — one row.
    const summarySql = `
      WITH bets AS (
        SELECT market, amount, block_time
          FROM ${SCHEMA}.bet_placed
         WHERE owner = $1
      ),
      claims AS (
        SELECT market, net, stranded
          FROM ${SCHEMA}.claimed
         WHERE owner = $1
      ),
      resolved AS (
        SELECT DISTINCT b.market
          FROM bets b
          JOIN ${SCHEMA}.market_resolved mr ON mr.market = b.market
      ),
      open_stake AS (
        SELECT COALESCE(SUM(b.amount), 0)::text AS amt
          FROM bets b
         WHERE NOT EXISTS (
           SELECT 1 FROM resolved r WHERE r.market = b.market
         )
      ),
      resolved_stake AS (
        SELECT COALESCE(SUM(b.amount), 0)::text AS amt
          FROM bets b
          JOIN resolved r ON r.market = b.market
      ),
      pnl_claims AS (
        SELECT COALESCE(
                 SUM(CASE WHEN c.stranded THEN 0 ELSE c.net END), 0
               )::text AS amt
          FROM claims c
      )
      SELECT (SELECT MIN(block_time)::text FROM bets) AS joined_at,
             (SELECT COALESCE(SUM(amount), 0)::text FROM bets) AS volume,
             (SELECT amt FROM pnl_claims)             AS pnl_claims,
             (SELECT amt FROM resolved_stake)         AS resolved_stake,
             (SELECT amt FROM open_stake)             AS stake_at_risk,
             (SELECT COUNT(*)::text FROM bets)        AS bets_count,
             (SELECT COUNT(*)::text FROM resolved)    AS resolved_count,
             (SELECT COUNT(*)::text
                FROM resolved r
                JOIN claims c ON c.market = r.market
               WHERE NOT c.stranded AND c.net::numeric > 0
             ) AS win_count
    `

    // Daily PnL series — last 30 days. We bucket by claim block_time
    // (the day the user actually saw the money), not by bet day. Stake
    // on resolved-lost markets shows up on the claim day too. A market
    // that resolved-lost and never got claimed (rare) still costs the
    // user — we deduct that stake on the resolution day instead.
    const seriesSql = `
      WITH days AS (
        SELECT generate_series(
                 (date_trunc('day', NOW()) - INTERVAL '29 days')::timestamp,
                 date_trunc('day', NOW())::timestamp,
                 INTERVAL '1 day'
               ) AS day
      ),
      claim_pnl AS (
        SELECT date_trunc('day', to_timestamp(c.block_time)) AS day,
               SUM(CASE WHEN c.stranded THEN 0 ELSE c.net END) AS amt
          FROM ${SCHEMA}.claimed c
         WHERE c.owner = $1 AND c.block_time IS NOT NULL
         GROUP BY 1
      ),
      lost_pnl AS (
        -- Stake on resolved-lost markets that we already accounted for
        -- via Claimed (net=0) — subtract the stake on the claim day.
        SELECT date_trunc('day', to_timestamp(c.block_time)) AS day,
               -SUM(b.amount) AS amt
          FROM ${SCHEMA}.claimed c
          JOIN ${SCHEMA}.bet_placed b
            ON b.market = c.market AND b.owner = c.owner
         WHERE c.owner = $1
           AND c.block_time IS NOT NULL
           AND NOT c.stranded
           AND c.net::numeric = 0
         GROUP BY 1
      ),
      won_stake AS (
        -- For winning claims, the .net is the gross payout including
        -- our stake. We subtract the stake here to get pure PnL.
        SELECT date_trunc('day', to_timestamp(c.block_time)) AS day,
               -SUM(b.amount) AS amt
          FROM ${SCHEMA}.claimed c
          JOIN ${SCHEMA}.bet_placed b
            ON b.market = c.market AND b.owner = c.owner
         WHERE c.owner = $1
           AND c.block_time IS NOT NULL
           AND NOT c.stranded
           AND c.net::numeric > 0
         GROUP BY 1
      )
      SELECT EXTRACT(EPOCH FROM d.day)::bigint::text AS day,
             COALESCE(
               (SELECT amt FROM claim_pnl WHERE day = d.day), 0
             ) +
             COALESCE(
               (SELECT amt FROM lost_pnl WHERE day = d.day), 0
             ) +
             COALESCE(
               (SELECT amt FROM won_stake WHERE day = d.day), 0
             ) AS pnl
        FROM days d
       ORDER BY d.day ASC
    `

    const [sumRes, seriesRes] = await Promise.all([
      pool.query<SummaryRow>(summarySql, [wallet]),
      pool.query<SeriesRow>(seriesSql, [wallet]),
    ])

    const row = sumRes.rows[0]
    if (!row) return NextResponse.json(emptySummary(wallet))

    const pnlClaims = safeBig(row.pnl_claims)
    const resolvedStake = safeBig(row.resolved_stake)
    const pnlRealized = pnlClaims - resolvedStake
    const resolvedCount = Number.parseInt(row.resolved_count, 10) || 0
    const winCount = Number.parseInt(row.win_count, 10) || 0

    const pnlSeries: UserPnlPoint[] = seriesRes.rows.map(r => ({
      ts: Number(r.day),
      pnl: r.pnl ?? '0',
    }))

    const summary: UserSummaryDTO = {
      wallet,
      joinedAt: row.joined_at != null ? Number(row.joined_at) : null,
      volume: row.volume,
      pnlRealized: pnlRealized.toString(),
      stakeAtRisk: row.stake_at_risk,
      betsCount: Number.parseInt(row.bets_count, 10) || 0,
      resolvedCount,
      winCount,
      winRate: resolvedCount === 0 ? null : winCount / resolvedCount,
      pnlSeries,
    }
    return NextResponse.json(summary)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/users/[wallet]/summary] query failed:', err)
    return NextResponse.json(emptySummary(wallet), { status: 500 })
  }
}
