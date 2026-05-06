import { getDataNodeServer } from '@/lib/config'

const ALLOWED_RANGES = new Set(['1d', '1w', '1m', 'all'])

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params
    const url = new URL(request.url)
    const rangeParam = (url.searchParams.get('range') ?? 'all').toLowerCase()
    const range = ALLOWED_RANGES.has(rangeParam) ? rangeParam : 'all'

    const upstream = await fetch(
      `${getDataNodeServer()}/account/${address.toLowerCase()}/pnl-history?range=${range}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8_000) },
    )
    if (!upstream.ok) throw new Error(`data-node ${upstream.status}`)
    return Response.json(await upstream.json(), {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' },
    })
  } catch {
    return Response.json(
      { range: 'all', bucket_secs: 21600, points: [], last_updated: null },
      { status: 502 },
    )
  }
}
