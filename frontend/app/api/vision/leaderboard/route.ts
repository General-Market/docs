import { NextResponse } from 'next/server'
import { ORACLE_VISION_URL } from '@/lib/config'

const ORACLE_URL = ORACLE_VISION_URL

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batch_id')
    const qs = batchId ? `?batch_id=${batchId}` : ''
    const res = await fetch(`${ORACLE_URL}/vision/leaderboard${qs}`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Vision leaderboard proxy error:', err)
    return NextResponse.json({ leaderboard: [], updatedAt: new Date().toISOString() }, { status: 502 })
  }
}
