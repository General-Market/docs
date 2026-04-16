import { NextResponse } from 'next/server'
import { getDataNodeServer } from '@/lib/config'

/**
 * Resolve a batch config hash to its full market list.
 *
 * The /vision/batches and /vision/batch/{id}/state endpoints deliberately
 * omit market_ids — the list is long and identical for every batch built
 * from the same source. Bots that need the bit-to-asset mapping call
 * this endpoint with the batch's config_hash and receive the canonical
 * markets array.
 *
 * GET /api/vision/config/by-hash/0xabc...
 * -> { markets: [ { market_id, resolution_type, ... } ], sourceId: "...", ... }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params
  if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'Invalid config hash — expect 0x-prefixed 32-byte hex' }, { status: 400 })
  }

  try {
    const upstream = await fetch(
      `${getDataNodeServer()}/batches/config/${hash}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) },
    )
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Config not found for hash ${hash}`, upstream_status: upstream.status },
        { status: 404 },
      )
    }
    const data = await upstream.json()
    const response = NextResponse.json(data)
    // Config is keyed by immutable hash — cache aggressively.
    response.headers.set('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return response
  } catch (e: any) {
    return NextResponse.json(
      { error: `Data-node unreachable: ${e.message}` },
      { status: 502 },
    )
  }
}
