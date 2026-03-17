import { NextResponse } from 'next/server'
import { DATA_NODE_SERVER } from '@/lib/config'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    // Forward query params as-is — data-node handles source_id→batch_id internally
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''
    const res = await fetch(`${DATA_NODE_SERVER}/vision/leaderboard${qs}`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Data-node API ${res.status}`)
    const data = await res.json()
    data._source = 'data-node'
    data._upstream = `${DATA_NODE_SERVER}/vision/leaderboard`
    return NextResponse.json(data)
  } catch (err) {
    console.error('Vision leaderboard proxy error:', err)
    return NextResponse.json({ leaderboard: [], updatedAt: new Date().toISOString() }, { status: 502 })
  }
}
