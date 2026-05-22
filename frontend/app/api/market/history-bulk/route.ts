import { NextRequest, NextResponse } from 'next/server'
import { getAaDataNodeUrl } from '@/lib/config'

/**
 * Bulk proxy: data-node /market/batch-history.
 * One call for many assets, grouped per asset_id in the response.
 *
 * GET /api/market/history-bulk?source=defi&assets=A,B,C&from=...&to=...
 *
 * The data-node endpoint itself does not need `source` — assets are queried by
 * asset_id directly — but we accept it for symmetry and future caching.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const assets = searchParams.get('assets')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!assets) {
    return NextResponse.json({ error: 'Missing assets' }, { status: 400 })
  }

  const url = new URL(`${getAaDataNodeUrl()}/market/batch-history`)
  url.searchParams.set('assets', assets)
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
