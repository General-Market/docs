import { NextRequest, NextResponse } from 'next/server'
import { getAaDataNodeUrl } from '@/lib/config'

/**
 * Proxy batch market price history from data-node.
 * Returns 7-day history for up to 16 assets in one call.
 *
 * GET /api/market/batch-history?assets=twitch_stream_ninja,twitch_stream_tfue,...
 */
export async function GET(req: NextRequest) {
  const assets = req.nextUrl.searchParams.get('assets')
  if (!assets) {
    return NextResponse.json({ error: 'Missing assets param' }, { status: 400 })
  }

  // Cap to 16 assets (4 cards × 4 markets)
  const ids = assets.split(',').filter(Boolean).slice(0, 16)
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No valid asset IDs' }, { status: 400 })
  }

  const now = new Date()
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const url = new URL(`${getAaDataNodeUrl()}/market/batch-history`)
  url.searchParams.set('assets', ids.join(','))
  url.searchParams.set('from', from.toISOString())
  url.searchParams.set('to', now.toISOString())

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
