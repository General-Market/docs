import { NextResponse } from 'next/server'
import { DATA_NODE_SERVER } from '@/lib/config'
import { toInternalId } from '@/lib/vision/source-ids'

async function tryFetch(source: string): Promise<Response | null> {
  try {
    const res = await fetch(
      `${DATA_NODE_SERVER}/batches/source/${encodeURIComponent(source)}/config`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) return res
  } catch {}
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params
  if (!source || source.length > 64) {
    return NextResponse.json({ markets: [] }, { status: 400 })
  }
  // Try internal ID first (translated from display ID), then raw source name as fallback
  const internalId = toInternalId(source)
  const candidates = internalId !== source ? [internalId, source] : [source]
  for (const name of candidates) {
    const res = await tryFetch(name)
    if (res) {
      const data = await res.json()
      if ((data.markets ?? []).length > 0) {
        const response = NextResponse.json(data)
        response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        return response
      }
    }
  }
  return NextResponse.json({ markets: [] })
}
