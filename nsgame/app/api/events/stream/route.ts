// GET /api/events/stream — Server-Sent Events
//
// Streams new bet_placed, market_resolved, and claimed rows as they
// land in Postgres. Uses LISTEN/NOTIFY on three channels — one
// dedicated pg client per request, released on disconnect.
//
// Clients reconnect with the standard EventSource `retry:` hint; no
// bespoke reconnect state lives here.

import { NextRequest } from 'next/server'
import { checkout, getSchema } from '@/lib/indexer/pg'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CHANNELS = ['pm_bet_placed', 'pm_market_resolved', 'pm_claimed'] as const
type Channel = typeof CHANNELS[number]

// pg's Notification type has `payload?: string`; we accept the same
// shape and guard the payload below.
import type { Notification as PgNotification } from 'pg'

export async function GET(req: NextRequest) {
  const schema = getSchema()
  const client = await checkout()

  const encoder = new TextEncoder()
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: string) => {
    controller.enqueue(encoder.encode(`event: ${event}\n`))
    controller.enqueue(encoder.encode(`data: ${data}\n\n`))
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Keep the client listening for the life of the request. Each
      // NOTIFY triggers one SQL round-trip to fetch the newly inserted
      // row, then we fan the payload out as an SSE event.
      const onNotification = (msg: PgNotification) => {
        const payload = msg.payload
        if (!payload) return
        void (async () => {
          try {
            const row = await fetchRow(client, schema, msg.channel as Channel, payload)
            if (row) send(controller, eventNameForChannel(msg.channel), JSON.stringify(row))
          } catch (err) {
            console.error('[events/stream] fetch row failed', err)
          }
        })()
      }
      client.on('notification', onNotification)

      try {
        for (const ch of CHANNELS) {
          await client.query(`LISTEN ${ch}`)
        }

        // Initial retry directive and a comment to flush headers.
        controller.enqueue(encoder.encode(`retry: 3000\n`))
        controller.enqueue(encoder.encode(`: connected\n\n`))

        // Keepalive ping every 25s — some proxies buffer silent
        // streams and kill them. A zero-width comment is enough to
        // prevent that without polluting the event log.
        const ping = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`))
          } catch {
            clearInterval(ping)
          }
        }, 25_000)

        // Disconnect path: release the pg client, unlisten, clear ping.
        const abort = () => {
          clearInterval(ping)
          client.off('notification', onNotification)
          for (const ch of CHANNELS) {
            client.query(`UNLISTEN ${ch}`).catch(() => {})
          }
          client.release()
          try { controller.close() } catch {}
        }
        req.signal.addEventListener('abort', abort, { once: true })
      } catch (err) {
        console.error('[events/stream] setup failed', err)
        client.release()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',   // nginx: do not buffer
    },
  })
}

function eventNameForChannel(ch: string): string {
  switch (ch) {
    case 'pm_bet_placed':      return 'BetPlaced'
    case 'pm_market_resolved': return 'MarketResolved'
    case 'pm_claimed':         return 'Claimed'
    default:                   return 'Unknown'
  }
}

type AnyRow = Record<string, unknown>

async function fetchRow(
  client: import('pg').PoolClient,
  schema: string,
  channel: Channel,
  signature: string,
): Promise<AnyRow | null> {
  if (channel === 'pm_bet_placed') {
    const r = await client.query(`
      SELECT bp.signature, bp.slot::text AS slot, bp.block_time::text AS block_time,
             bp.market, bp.owner, bp.side, bp.amount::text AS amount,
             mi.source_id, mi.threshold_bps,
             mi.close_time::text AS close_time,
             mi.settlement_time::text AS settlement_time,
             mi.creator
      FROM "${schema}".bet_placed bp
      LEFT JOIN LATERAL (
        SELECT source_id, threshold_bps, close_time, settlement_time, creator
        FROM "${schema}".market_instantiated
        WHERE market = bp.market
        ORDER BY slot DESC LIMIT 1
      ) mi ON TRUE
      WHERE bp.signature = $1
    `, [signature])
    const row = r.rows[0]
    if (!row) return null
    return {
      type: 'BetPlaced',
      signature: row.signature,
      slot: row.slot,
      blockTime: row.block_time,
      market: row.market,
      owner: row.owner,
      side: row.side,
      amount: row.amount,
      marketMeta: {
        market: row.market,
        sourceId: row.source_id,
        thresholdBps: row.threshold_bps,
        closeTime: row.close_time,
        settlementTime: row.settlement_time,
        creator: row.creator,
        resolved: false,
        outcomeYes: null,
        finalPrice: null,
        baselinePrice: null,
        forceResolved: null,
      },
    }
  }
  if (channel === 'pm_market_resolved') {
    const r = await client.query(`
      SELECT signature, slot::text AS slot, block_time::text AS block_time,
             market,
             baseline_price::text AS baseline_price,
             final_price::text    AS final_price,
             outcome_yes, force_resolved
      FROM "${schema}".market_resolved
      WHERE signature = $1
    `, [signature])
    const row = r.rows[0]
    if (!row) return null
    return {
      type: 'MarketResolved',
      signature: row.signature,
      slot: row.slot,
      blockTime: row.block_time,
      market: row.market,
      baselinePrice: row.baseline_price,
      finalPrice: row.final_price,
      outcomeYes: row.outcome_yes,
      forceResolved: row.force_resolved,
    }
  }
  // pm_claimed
  const r = await client.query(`
    SELECT signature, slot::text AS slot, block_time::text AS block_time,
           market, owner,
           net::text AS net, fee::text AS fee, stranded
    FROM "${schema}".claimed
    WHERE signature = $1
  `, [signature])
  const row = r.rows[0]
  if (!row) return null
  return {
    type: 'Claimed',
    signature: row.signature,
    slot: row.slot,
    blockTime: row.block_time,
    market: row.market,
    owner: row.owner,
    net: row.net,
    fee: row.fee,
    stranded: row.stranded,
  }
}
