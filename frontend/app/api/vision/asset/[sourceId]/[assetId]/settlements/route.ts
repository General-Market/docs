import { getIssuerVisionUrl } from '@/lib/config'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourceId: string; assetId: string }> },
) {
  try {
    const { sourceId, assetId } = await params
    const { searchParams } = new URL(request.url)
    const qs = new URLSearchParams(searchParams)
    const url = `${getIssuerVisionUrl()}/vision/asset/${encodeURIComponent(
      sourceId,
    )}/${encodeURIComponent(assetId)}/settlements?${qs}`
    const res = await fetch(url, {
      cache: 'no-store',
      // Oracle JSONB scan + 99-row TOAST detoast can take ~30s under load.
      // nginx upstream is 60s; keep us under it but well above the median.
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    return Response.json(await res.json())
  } catch (e) {
    console.error('Vision asset settlements proxy error:', e)
    // 503 — temporary unavailability — lets the client distinguish from
    // a 200 with an empty `settlements` array (which means "no participants").
    return Response.json(
      { settlements: [], error: 'upstream_unavailable' },
      { status: 503 },
    )
  }
}
