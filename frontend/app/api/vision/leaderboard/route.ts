import { NextResponse } from 'next/server'
import { ORACLE_VISION_URL } from '@/lib/config'
import visionBatchesJson from '@/lib/contracts/vision-batches.json'

// source name → batchId from deployment manifest
const SOURCE_TO_BATCH_ID: Record<string, number> = {}
for (const [key, val] of Object.entries(visionBatchesJson.batches)) {
  SOURCE_TO_BATCH_ID[key] = (val as any).batchId
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const params = new URLSearchParams()
    const batchId = searchParams.get('batch_id')
    const sourceId = searchParams.get('source_id')

    // Oracle's source_id filter uses ASCII-padded hex which doesn't match
    // the on-chain keccak256 source_id. Convert to batch_id instead.
    if (sourceId && SOURCE_TO_BATCH_ID[sourceId] !== undefined) {
      params.set('batch_id', String(SOURCE_TO_BATCH_ID[sourceId]))
    } else if (batchId) {
      params.set('batch_id', batchId)
    }

    const qs = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${ORACLE_VISION_URL}/vision/leaderboard${qs}`, {
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
