import { ISSUER_VISION_URL as ORACLE_VISION_URL } from '@/lib/config'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params
    const { searchParams } = new URL(request.url)
    const qs = new URLSearchParams(searchParams)
    const res = await fetch(`${ORACLE_VISION_URL}/vision/player/${address}/rounds?${qs}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    return Response.json(await res.json())
  } catch (e) {
    console.error('Vision player rounds proxy error:', e)
    return Response.json({ rounds: [] }, { status: 502 })
  }
}
