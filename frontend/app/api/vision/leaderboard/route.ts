import { NextResponse } from 'next/server'
import { getIssuerVisionUrl } from '@/lib/config'
import { toInternalId } from '@/lib/vision/source-ids'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batch_id')
    // Accept either `source_id` (canonical) or `source` (shorthand used by
    // some callers + smoke curls). The upstream only knows `source_id`.
    const sourceId = searchParams.get('source_id') || searchParams.get('source')
    const params = new URLSearchParams()
    if (sourceId) params.set('source_id', toInternalId(sourceId))
    else if (batchId) params.set('batch_id', batchId)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${getIssuerVisionUrl()}/vision/leaderboard${qs}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()

    // Pagination — upstream returns all players, slice here
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const entries: unknown[] = Array.isArray(data?.leaderboard) ? data.leaderboard : Array.isArray(data) ? data : []
    const total = entries.length
    const start = (page - 1) * limit
    const paged = entries.slice(start, start + limit)

    return NextResponse.json(
      {
        leaderboard: paged,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        updatedAt: data?.updatedAt || new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  } catch (err) {
    console.error('Vision leaderboard proxy error:', err)
    return NextResponse.json({ leaderboard: [], updatedAt: new Date().toISOString() }, { status: 502 })
  }
}
