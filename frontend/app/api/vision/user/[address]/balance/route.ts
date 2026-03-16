import { ORACLE_VISION_URL } from '@/lib/config'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  try {
    const res = await fetch(`${ORACLE_VISION_URL}/vision/user/${address}/balance`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return Response.json({ realBalance: '0', virtualBalance: '0', total: '0' })
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ realBalance: '0', virtualBalance: '0', total: '0' })
  }
}
