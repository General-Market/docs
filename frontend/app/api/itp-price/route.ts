import { NextRequest, NextResponse } from 'next/server'

const DATA_NODE_URL = process.env.DATA_NODE_URL || process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

export async function GET(request: NextRequest) {
  const itpId = request.nextUrl.searchParams.get('itp_id')
  if (!itpId) {
    return NextResponse.json({ error: 'itp_id required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${DATA_NODE_URL}/itp-price?itp_id=${encodeURIComponent(itpId)}`, {
      next: { revalidate: 2 },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`Data node ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ nav: '0', nav_display: '0', assets_priced: 0, assets_total: 0 }, { status: 502 })
  }
}
