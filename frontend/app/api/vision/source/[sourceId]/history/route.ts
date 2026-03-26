import { NextResponse } from 'next/server'
import { getIssuerVisionUrl } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
  try {
    const res = await fetch(
      `${getIssuerVisionUrl()}/vision/source/${encodeURIComponent(sourceId)}/history`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return NextResponse.json({ batches: [] }, { status: res.status })
    const data = await res.json()
    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return response
  } catch {
    return NextResponse.json({ batches: [] }, { status: 502 })
  }
}
