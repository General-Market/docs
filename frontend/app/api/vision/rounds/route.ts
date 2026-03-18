import { ORACLE_VISION_URL } from '@/lib/config'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const params = new URLSearchParams(searchParams)
    const res = await fetch(`${ORACLE_VISION_URL}/vision/rounds?${params}`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    return Response.json(await res.json())
  } catch (e) {
    console.error('Vision rounds proxy error:', e)
    return Response.json({ rounds: [] }, { status: 502 })
  }
}
