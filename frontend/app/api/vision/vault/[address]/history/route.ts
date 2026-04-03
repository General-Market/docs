import { getIssuerVisionUrl } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params
    const res = await fetch(
      `${getIssuerVisionUrl()}/vision/vault/${address}/history`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    return Response.json(await res.json(), {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    })
  } catch {
    return Response.json({ snapshots: [] }, { status: 502 })
  }
}
