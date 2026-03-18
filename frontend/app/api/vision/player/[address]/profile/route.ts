import { ISSUER_VISION_URL as ORACLE_VISION_URL } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await params
    const res = await fetch(`${ORACLE_VISION_URL}/vision/player/${address}/profile`, {
      next: { revalidate: 10 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    return Response.json(await res.json())
  } catch (e) {
    console.error('Vision player profile proxy error:', e)
    return Response.json(
      { stats: { pnl: 0, totalDeposited: 0, roi: 0, winRate: 0, totalBatches: 0, lastActiveAt: null }, batches: [], pnlHistory: [] },
      { status: 502 },
    )
  }
}
