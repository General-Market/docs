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
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    return Response.json(await res.json())
  } catch (e) {
    console.error('Vision asset settlements proxy error:', e)
    return Response.json({ settlements: [] }, { status: 502 })
  }
}
