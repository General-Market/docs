// GET /api/events/history/[owner]
//
// Returns the last 200 events touching a specific owner — bet_placed,
// bet_exited, claimed — each joined with the market metadata known at
// the time the indexer observed it. Owner is a base58 pubkey.

import { NextRequest } from 'next/server'
import { query } from '@/lib/indexer/pg'
import type { HistoryRow } from '@/lib/indexer/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_ROWS = 200

interface RawHistoryRow {
  kind: 'BetPlaced' | 'BetExited' | 'Claimed'
  signature: string
  slot: string
  block_time: string | null
  market: string
  owner: string
  side: number | null
  amount: string | null
  net: string | null
  fee: string | null
  stranded: boolean | null
  source_id: number | null
  threshold_bps: number | null
  close_time: string | null
  settlement_time: string | null
  creator: string | null
  resolved: boolean | null
  outcome_yes: boolean | null
  final_price: string | null
  baseline_price: string | null
  force_resolved: boolean | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string }> },
) {
  const { owner } = await params
  if (!owner || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(owner)) {
    return Response.json({ error: 'invalid owner pubkey' }, { status: 400 })
  }

  try {
    // One union query: three event tables + a lateral join onto the
    // most recent MarketInstantiated row per market. MarketResolved is
    // folded in via LEFT JOIN so we can report outcome + final_price
    // when the market has already settled.
    const sql = `
      WITH rows AS (
        SELECT
          'BetPlaced'::text    AS kind,
          bp.signature, bp.slot, bp.block_time, bp.market, bp.owner,
          bp.side, bp.amount::text AS amount,
          NULL::text AS net, NULL::text AS fee, NULL::boolean AS stranded
        FROM __SCHEMA__.bet_placed bp
        WHERE bp.owner = $1
        UNION ALL
        SELECT
          'BetExited'::text,
          be.signature, be.slot, be.block_time, be.market, be.owner,
          be.side, be.amount::text,
          NULL, NULL, NULL
        FROM __SCHEMA__.bet_exited be
        WHERE be.owner = $1
        UNION ALL
        SELECT
          'Claimed'::text,
          c.signature, c.slot, c.block_time, c.market, c.owner,
          NULL::smallint, NULL::text,
          c.net::text, c.fee::text, c.stranded
        FROM __SCHEMA__.claimed c
        WHERE c.owner = $1
      )
      SELECT
        r.kind, r.signature, r.slot::text AS slot,
        r.block_time::text AS block_time,
        r.market, r.owner, r.side, r.amount,
        r.net, r.fee, r.stranded,
        mi.source_id, mi.threshold_bps,
        mi.close_time::text AS close_time,
        mi.settlement_time::text AS settlement_time,
        mi.creator,
        mr.signature IS NOT NULL AS resolved,
        mr.outcome_yes,
        mr.final_price::text    AS final_price,
        mr.baseline_price::text AS baseline_price,
        mr.force_resolved
      FROM rows r
      LEFT JOIN LATERAL (
        SELECT source_id, threshold_bps, close_time, settlement_time, creator
        FROM __SCHEMA__.market_instantiated
        WHERE market = r.market
        ORDER BY slot DESC LIMIT 1
      ) mi ON TRUE
      LEFT JOIN LATERAL (
        SELECT signature, outcome_yes, final_price, baseline_price, force_resolved
        FROM __SCHEMA__.market_resolved
        WHERE market = r.market
        ORDER BY slot DESC LIMIT 1
      ) mr ON TRUE
      ORDER BY r.slot DESC, r.signature
      LIMIT $2
    `
    const rows = await query<RawHistoryRow>(sql, [owner, MAX_ROWS])
    const events: HistoryRow[] = rows.map(shape)
    return Response.json({ events })
  } catch (err) {
    console.error('[events/history] query failed', err)
    return Response.json({ error: 'query failed' }, { status: 500 })
  }
}

function shape(r: RawHistoryRow): HistoryRow {
  const marketMeta = {
    market: r.market,
    sourceId: r.source_id,
    thresholdBps: r.threshold_bps,
    closeTime: r.close_time,
    settlementTime: r.settlement_time,
    creator: r.creator,
    resolved: Boolean(r.resolved),
    outcomeYes: r.outcome_yes,
    finalPrice: r.final_price,
    baselinePrice: r.baseline_price,
    forceResolved: r.force_resolved,
  }
  const common = {
    signature: r.signature,
    slot: r.slot,
    blockTime: r.block_time,
    market: r.market,
    owner: r.owner,
    marketMeta,
  }
  if (r.kind === 'BetPlaced') {
    return {
      type: 'BetPlaced',
      ...common,
      side: (r.side ?? 0) as 0 | 1,
      amount: r.amount ?? '0',
    }
  }
  if (r.kind === 'BetExited') {
    return {
      type: 'BetExited',
      ...common,
      side: (r.side ?? 0) as 0 | 1,
      amount: r.amount ?? '0',
    }
  }
  return {
    type: 'Claimed',
    ...common,
    net: r.net ?? '0',
    fee: r.fee ?? '0',
    stranded: Boolean(r.stranded),
  }
}
