import { ORACLE_VISION_URL } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const { batchId } = await params
    const res = await fetch(`${ORACLE_VISION_URL}/vision/rounds/${batchId}/results`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    return Response.json(await res.json())
  } catch (e) {
    console.error('Vision round results proxy error:', e)
    return Response.json({ rounds: [] }, { status: 502 })
  }
}
