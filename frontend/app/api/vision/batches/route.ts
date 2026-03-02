import { NextResponse } from 'next/server'
import batchConfig from '@/lib/contracts/vision-batches.json'

const ISSUER_URL = process.env.ISSUER_VISION_URL || 'http://localhost:10001'

// Build reverse lookup: sourceId hash → source name from vision-batches.json
const hashToSource: Record<string, string> = {}
for (const [sourceId, entry] of Object.entries(batchConfig.batches as Record<string, { batchId: number; configHash: string }>)) {
  hashToSource[entry.batchId] = sourceId
}

export async function GET() {
  try {
    const res = await fetch(`${ISSUER_URL}/vision/batches`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()

    // Enrich source_id: issuer returns keccak256 hash, frontend needs string name
    const batches = (data.batches ?? []).map((b: any) => ({
      ...b,
      source_id: hashToSource[b.id] ?? b.source_id,
    }))

    return NextResponse.json({ batches })
  } catch (err) {
    console.error('Vision batches proxy error:', err)
    return NextResponse.json({ batches: [] }, { status: 502 })
  }
}
