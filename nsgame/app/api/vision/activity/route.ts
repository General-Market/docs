import { NextRequest } from 'next/server'
import { getIssuerVisionUrl } from '@/lib/config'

const VALID_RANGES = ['1h', '6h', '24h', '7d']

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const range = searchParams.get('range') || '24h'
  const bucketMins = searchParams.get('bucket_mins') || '5'

  if (!VALID_RANGES.includes(range)) {
    return Response.json({ error: 'Invalid range' }, { status: 400 })
  }

  const mins = parseInt(bucketMins, 10)
  if (isNaN(mins) || mins < 1 || mins > 60) {
    return Response.json({ error: 'Invalid bucket_mins (1-60)' }, { status: 400 })
  }

  try {
    const url = `${getIssuerVisionUrl()}/vision/activity?range=${range}&bucket_mins=${mins}`
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Upstream ${res.status}`)
    const data = await res.json()
    return Response.json(data, {
      headers: { 'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch {
    return Response.json({ buckets: [], range, bucket_mins: mins }, { status: 502 })
  }
}
