import { NextResponse } from 'next/server'
import { DATA_NODE_SERVER } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params
  if (!source || source.length > 64) {
    return NextResponse.json({ markets: [] }, { status: 400 })
  }
  try {
    const res = await fetch(
      `${DATA_NODE_SERVER}/batches/source/${encodeURIComponent(source)}/config`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return NextResponse.json({ markets: [] })
    const data = await res.json()
    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return response
  } catch {
    return NextResponse.json({ markets: [] })
  }
}
