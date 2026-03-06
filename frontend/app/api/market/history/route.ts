import { NextRequest, NextResponse } from 'next/server'
import { AA_DATA_NODE_URL } from '@/lib/config'

/**
 * Proxy market price history from data-node.
 * Avoids mixed-content (HTTP data-node from HTTPS page).
 *
 * GET /api/market/history?source=earthquake&asset=USGS/...&from=...&to=...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const source = searchParams.get('source')
  const asset = searchParams.get('asset')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!source || !asset) {
    return NextResponse.json({ error: 'Missing source or asset' }, { status: 400 })
  }

  const url = new URL(`${AA_DATA_NODE_URL}/market/prices/${source}/${encodeURIComponent(asset)}/history`)
  if (from) url.searchParams.set('from', from)
  if (to) url.searchParams.set('to', to)

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
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
