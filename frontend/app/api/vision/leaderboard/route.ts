import { NextResponse } from 'next/server'
import { ISSUER_VISION_URL } from '@/lib/config'

const ISSUER_URL = ISSUER_VISION_URL

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batch_id')
    const sourceId = searchParams.get('source_id')
    const params = new URLSearchParams()
    if (sourceId) params.set('source_id', sourceId)
    else if (batchId) params.set('batch_id', batchId)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${ISSUER_URL}/vision/leaderboard${qs}`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Vision leaderboard proxy error:', err)
    return NextResponse.json({ leaderboard: [], updatedAt: new Date().toISOString() }, { status: 502 })
  }
}
