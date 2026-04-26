// GET /api/leaderboard?window=24h|7d|30d|all&limit=&offset= — a global
// PnL ranking across every wallet the indexer has seen.
//
// PnL is realized only. We do not invent unrealized PnL for parimutuel
// pools — there's no liquid secondary market on devnet, and a midpoint
// estimate would lie. Open positions show as `stakeAtRisk`, separate
// from `pnlRealized`.
//
// Mirrors the singleton-pool pattern of /api/positions/[wallet] and
// /api/activity. POSTGRES_URL missing → empty array, 200.
//
// Source of truth: the event-indexer Postgres on VPS 3.
//   bet_placed       — every bet, signed by owner, in 6-decimal USDC
//   claimed          — every settled payout (positive net = won; stranded = refund)
//   market_resolved  — only resolved markets count toward win-rate denom
//
// Window filtering applies to bet_placed.block_time. Claims and
// resolutions are joined unconditionally — a bet placed inside the
// window that resolved outside still counts. Otherwise a "24h" window
// would erase every claim we made yesterday for a market that resolved
// this morning.

import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type LeaderboardWindow = '24h' | '7d' | '30d' | 'all'

export interface LeaderboardEntryDTO {
  rank: number
  wallet: string
  /** Sum of bet_placed.amount in 6-decimal USDC string. */
  volume: string
  /** Realized PnL in 6-decimal USDC string, signed. */
  pnlRealized: string
  /** Realized PnL as percentage of volume. Float, signed. */
  pnlPct: number
  /** Stake currently locked in unresolved markets, 6-decimal USDC string. */
  stakeAtRisk: string
  /** Number of resolved markets the wallet had a position in. */
  resolvedCount: number
  /** Number of those it won. */
  winCount: number
  /** Win rate as 0..1 float; null if no resolved positions yet. */
  winRate: number | null
  /** Number of bets placed in window. */
  betsCount: number
  /** Last bet block_time, unix seconds; null if none. */
  lastActive: number | null
}

interface LeaderboardRow {
  wallet: string
  volume: string
  pnl_realised: string
  stake_at_risk: string
  resolved_count: string
  win_count: string
  bets_count: string
  last_active: string | null
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

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function clampInt(raw: string | null, def: number, max: number): number {
  if (!raw) return def
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return def
  return Math.min(n, max)
}

function parseWindow(raw: string | null): LeaderboardWindow {
  if (raw === '24h' || raw === '7d' || raw === '30d' || raw === 'all') return raw
  return '7d'
}

function windowSeconds(w: LeaderboardWindow): number | null {
  if (w === '24h') return 24 * 3600
  if (w === '7d') return 7 * 24 * 3600
  if (w === '30d') return 30 * 24 * 3600
  return null
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const window = parseWindow(searchParams.get('window'))
  const limit = clampInt(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT)
  const offset = clampInt(searchParams.get('offset'), 0, 10_000)

  const pool = getPool()
  if (!pool) {
    return NextResponse.json({
      window,
      entries: [] satisfies LeaderboardEntryDTO[],
    })
  }

  const cutoff = windowSeconds(window)
  // The window predicate filters bet_placed by block_time. NULL block_times
  // are treated as "always included" — better to show a row with a
  // missing timestamp than to silently drop it.
  const windowPredicate = cutoff === null
    ? 'TRUE'
    : '(bp.block_time IS NULL OR bp.block_time >= $1::bigint)'
  const params: Array<number> = []
  if (cutoff !== null) {
    params.push(Math.floor(Date.now() / 1000) - cutoff)
  }
  // limit + offset — appended after the window param.
  params.push(limit, offset)
  const limitIdx = cutoff === null ? 1 : 2
  const offsetIdx = cutoff === null ? 2 : 3

  try {
    // Single rollup: one row per wallet, joined left-of against claims
    // (per-market) and resolutions (per-market). Win count is markets
    // where this wallet had a positive net claim. Stake at risk is the
    // sum of amounts on markets we have neither resolved nor claimed.
    // PnL is realized only — we count a market once the wallet has
    // claimed it. Resolved-but-unclaimed markets stay in stake_at_risk:
    // the wallet's win is sitting on chain waiting to be collected, and
    // counting the bet as a full loss until then would slander every
    // wallet that doesn't auto-claim. (One bot was 484 markets / $10k
    // unclaimed; its leaderboard line read -$8.5k of pure phantom.)
    const sql = `
      WITH bets AS (
        SELECT bp.owner       AS wallet,
               bp.market,
               bp.amount,
               bp.block_time,
               bp.signature
          FROM ${SCHEMA}.bet_placed bp
         WHERE ${windowPredicate}
      ),
      per_wallet_market_stake AS (
        SELECT wallet, market, SUM(amount) AS stake
          FROM bets
         GROUP BY wallet, market
      ),
      per_wallet_bets AS (
        SELECT wallet,
               SUM(amount)::text       AS volume,
               COUNT(*)::text          AS bets_count,
               MAX(block_time)::text   AS last_active
          FROM bets
         GROUP BY wallet
      ),
      claimed_realised AS (
        -- One row per (wallet, market) the wallet has claimed.
        -- payout = c.net for non-stranded; full stake refund for stranded.
        SELECT s.wallet,
               s.market,
               s.stake,
               (CASE WHEN c.stranded THEN s.stake ELSE c.net::numeric END) AS payout,
               c.stranded
          FROM per_wallet_market_stake s
          JOIN ${SCHEMA}.claimed c
            ON c.market = s.market AND c.owner = s.wallet
      ),
      per_wallet_realised AS (
        -- A "win" here is a market where the wallet had a non-stranded
        -- claim with positive payout — the wallet was on the winning
        -- side. For wallets that bet only one side per market this
        -- matches intuition; for self-betting bots it counts the
        -- markets where their winning-side stake collected something,
        -- even though the round-trip nets the fee. Either way it tracks
        -- the row visible to the user.
        SELECT wallet,
               SUM(payout - stake)::text         AS pnl_realised,
               COUNT(*)::text                    AS resolved_count,
               COUNT(*) FILTER (
                 WHERE NOT stranded AND payout > 0
               )::text                           AS win_count
          FROM claimed_realised
         GROUP BY wallet
      ),
      per_wallet_open AS (
        -- Stake on every (wallet, market) the wallet has NOT yet claimed,
        -- regardless of whether the market itself resolved. This bucket
        -- absorbs both live bets and pending claims.
        SELECT s.wallet,
               SUM(s.stake)::text AS stake_at_risk
          FROM per_wallet_market_stake s
          LEFT JOIN ${SCHEMA}.claimed c
                 ON c.market = s.market AND c.owner = s.wallet
         WHERE c.market IS NULL
         GROUP BY s.wallet
      )
      SELECT pwb.wallet                              AS wallet,
             pwb.volume                              AS volume,
             COALESCE(pwr.pnl_realised, '0')         AS pnl_realised,
             COALESCE(pwo.stake_at_risk, '0')        AS stake_at_risk,
             COALESCE(pwr.resolved_count, '0')       AS resolved_count,
             COALESCE(pwr.win_count, '0')            AS win_count,
             pwb.bets_count                          AS bets_count,
             pwb.last_active                         AS last_active
        FROM per_wallet_bets pwb
        LEFT JOIN per_wallet_realised pwr ON pwr.wallet = pwb.wallet
        LEFT JOIN per_wallet_open     pwo ON pwo.wallet = pwb.wallet
       ORDER BY COALESCE(pwr.pnl_realised, '0')::numeric DESC,
                pwb.volume::numeric DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `

    interface RawRow extends LeaderboardRow {
      pnl_realised: string
    }

    const result = await pool.query<RawRow>(sql, params)
    const entries: LeaderboardEntryDTO[] = result.rows.map((r, i) => {
      const volumeBig = safeBig(r.volume)
      const pnlRealized = safeBig(r.pnl_realised)
      const resolvedCount = Number.parseInt(r.resolved_count, 10) || 0
      const winCount = Number.parseInt(r.win_count, 10) || 0
      // Percent off volume. Empty volume → 0%, never NaN.
      const pnlPct = volumeBig === 0n
        ? 0
        : Number((pnlRealized * 10_000n) / volumeBig) / 100
      return {
        rank: offset + i + 1,
        wallet: r.wallet,
        volume: r.volume,
        pnlRealized: pnlRealized.toString(),
        pnlPct,
        stakeAtRisk: r.stake_at_risk,
        resolvedCount,
        winCount,
        winRate: resolvedCount === 0 ? null : winCount / resolvedCount,
        betsCount: Number.parseInt(r.bets_count, 10) || 0,
        lastActive: r.last_active != null ? Number(r.last_active) : null,
      }
    })

    return NextResponse.json({ window, entries })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/leaderboard] query failed:', err)
    return NextResponse.json(
      { window, entries: [] satisfies LeaderboardEntryDTO[], error: 'query_failed' },
      { status: 500 },
    )
  }
}

function safeBig(v: string | null | undefined): bigint {
  if (v == null) return 0n
  try { return BigInt(v) } catch { return 0n }
}
