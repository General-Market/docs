import { ISSUER_VISION_URL } from '@/lib/config'
import visionBatchesJson from '@/lib/contracts/vision-batches.json'

// Reverse map: batchId → human-readable source key (e.g. 215 → "defi", 232 → "polymarket")
const BATCH_ID_TO_SOURCE: Record<number, string> = {}
for (const [key, val] of Object.entries(visionBatchesJson.batches)) {
  BATCH_ID_TO_SOURCE[(val as any).batchId] = key
}

export async function GET() {
  try {
    const res = await fetch(`${ISSUER_VISION_URL}/vision/batches`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()

    // Enrich: replace keccak256 hex source_id with human-readable name from vision-batches.json
    for (const batch of (data.batches ?? [])) {
      const name = BATCH_ID_TO_SOURCE[batch.id]
      if (name) batch.source_id = name
    }

    // Deduplicate: keep latest batch per source
    const latestPerSource = new Map<string, any>()
    for (const batch of (data.batches ?? [])) {
      const existing = latestPerSource.get(batch.source_id)
      if (!existing || batch.id > existing.id) {
        latestPerSource.set(batch.source_id, batch)
      }
    }

    return Response.json({ batches: Array.from(latestPerSource.values()) })
  } catch (e) {
    console.error('Vision batches proxy error:', e)
    return Response.json({ batches: [] }, { status: 502 })
  }
}
