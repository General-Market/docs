import { NextResponse } from 'next/server'
import { getIssuerVisionUrl } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }
  try {
    const res = await fetch(
      `${getIssuerVisionUrl()}/vision/player/${address.toLowerCase()}/profile`,
      { cache: 'no-store', signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return NextResponse.json({ error: 'Profile unavailable' }, { status: res.status })
    const data = await res.json()
    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return response
  } catch {
    return NextResponse.json({ error: 'Profile unavailable' }, { status: 502 })
  }
}
