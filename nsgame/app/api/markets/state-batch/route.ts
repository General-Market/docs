// POST /api/markets/state-batch
//   body: { pdas: string[] }
//   returns: { states: { [pda]: MarketStateDTO | null } }
//
// Mirrors what `useMarketStatesBatch` used to fetch from Solana RPC,
// but reads from the indexer's event tables. Browsers stop hammering
// Helius for pool sizes — reads land on our Postgres in <50 ms and
// never 429.
//
// Rolled live on every call: SUM(bet_placed) − SUM(bet_exited) per side
// is the only honest pool size. The on-chain Market account holds the
// same number, but we already capture every event upstream.
//
// Same singleton-pool pattern as /api/leaderboard. POSTGRES_URL missing
// → empty map, 200. Local devs without a tunnel keep rendering.

import { NextResponse } from 'next/server'
import { Pool } from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface MarketStateDTO {
  /** Sum of yes-side bet amounts (minus exits), 6-decimal USDC string. */
  totalYes: string
  /** Sum of no-side bet amounts (minus exits), 6-decimal USDC string. */
  totalNo: string
  /** Whether the market has emitted a resolved event. */
  resolved: boolean
  /** When resolved, the winning side; null otherwise. */
  outcomeYes: boolean | null
  /** Baseline price recorded at close. Null until close lands. */
  baselinePrice: string | null
  /** Final price recorded at resolve. Null until resolve lands. */
  finalPrice: string | null
}

interface RawRow {
  market: string
  total_yes: string | null
  total_no: string | null
  baseline_price: string | null
  final_price: string | null
  resolved: boolean
  outcome_yes: boolean | null
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
const MAX_PDAS = 200

function isPlausiblePda(s: unknown): s is string {
  return typeof s === 'string' && s.length >= 32 && s.length <= 64
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch { body = null }

  const raw = (body as { pdas?: unknown } | null)?.pdas
  const pdas = Array.isArray(raw)
    ? Array.from(new Set(raw.filter(isPlausiblePda))).slice(0, MAX_PDAS)
    : []

  if (pdas.length === 0) {
    return NextResponse.json({ states: {} })
  }

  const pool = getPool()
  if (!pool) {
    return NextResponse.json({ states: {} })
  }

  try {
    // One round-trip. The aggregates are all per-market, so a join on
    // market is enough; no GROUP BY at the outer layer.
    const sql = `
      WITH placed AS (
        SELECT market,
               SUM(CASE WHEN side = 0 THEN amount ELSE 0 END) AS yes,
               SUM(CASE WHEN side = 1 THEN amount ELSE 0 END) AS no
          FROM ${SCHEMA}.bet_placed
         WHERE market = ANY($1::text[])
         GROUP BY market
      ),
      exited AS (
        SELECT market,
               SUM(CASE WHEN side = 0 THEN amount ELSE 0 END) AS yes,
               SUM(CASE WHEN side = 1 THEN amount ELSE 0 END) AS no
          FROM ${SCHEMA}.bet_exited
         WHERE market = ANY($1::text[])
         GROUP BY market
      ),
      mc AS (
        SELECT DISTINCT ON (market) market, baseline_price
          FROM ${SCHEMA}.market_closed
         WHERE market = ANY($1::text[])
         ORDER BY market, slot DESC
      ),
      mr AS (
        SELECT DISTINCT ON (market) market, baseline_price, final_price, outcome_yes
          FROM ${SCHEMA}.market_resolved
         WHERE market = ANY($1::text[])
         ORDER BY market, slot DESC
      )
      SELECT
        m.market AS market,
        (COALESCE(p.yes, 0) - COALESCE(e.yes, 0))::text AS total_yes,
        (COALESCE(p.no,  0) - COALESCE(e.no,  0))::text AS total_no,
        COALESCE(mr.baseline_price, mc.baseline_price)::text AS baseline_price,
        mr.final_price::text AS final_price,
        (mr.market IS NOT NULL) AS resolved,
        mr.outcome_yes AS outcome_yes
      FROM unnest($1::text[]) AS m(market)
      LEFT JOIN placed p ON p.market = m.market
      LEFT JOIN exited e ON e.market = m.market
      LEFT JOIN mc       ON mc.market = m.market
      LEFT JOIN mr       ON mr.market = m.market
    `
    const result = await pool.query<RawRow>(sql, [pdas])
    const states: Record<string, MarketStateDTO | null> = {}
    for (const r of result.rows) {
      // If the indexer has zero events for a PDA (no instantiation,
      // no bets), every aggregate is null. Mirror Helius's behaviour
      // and return null so the frontend can fall back to its skeleton.
      const hasAny =
        (r.total_yes && r.total_yes !== '0') ||
        (r.total_no && r.total_no !== '0') ||
        r.baseline_price != null ||
        r.final_price != null ||
        r.resolved
      if (!hasAny) {
        states[r.market] = null
        continue
      }
      states[r.market] = {
        totalYes: r.total_yes ?? '0',
        totalNo: r.total_no ?? '0',
        resolved: !!r.resolved,
        outcomeYes: r.resolved ? r.outcome_yes ?? null : null,
        baselinePrice: r.baseline_price ?? null,
        finalPrice: r.resolved ? r.final_price ?? null : null,
      }
    }
    // Make sure every requested key is present in the response.
    for (const p of pdas) {
      if (!(p in states)) states[p] = null
    }
    return NextResponse.json({ states })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/markets/state-batch] query failed:', err)
    return NextResponse.json({ states: {}, error: 'query_failed' }, { status: 500 })
  }
}
