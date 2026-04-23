import { getIssuerVisionUrl } from '@/lib/config'

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
    const res = await fetch(
      `${getIssuerVisionUrl()}/vision/vault/${address}/history?range=${range}`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    return Response.json(await res.json(), {
      // Short cache per range — the fund-manager writes every ~4.5 min.
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    })
  } catch {
    return Response.json({ snapshots: [] }, { status: 502 })
  }
}
