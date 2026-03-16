import { ORACLE_VISION_URL } from '@/lib/config'
import visionBatchesJson from '@/lib/contracts/vision-batches.json'

// Reverse maps from vision-batches.json: batchId → source name, batchId → configHash
const BATCH_ID_TO_SOURCE: Record<number, string> = {}
const BATCH_ID_TO_CONFIG_HASH: Record<number, string> = {}
for (const [key, val] of Object.entries(visionBatchesJson.batches)) {
  const v = val as any
  BATCH_ID_TO_SOURCE[v.batchId] = key
  if (v.configHash) BATCH_ID_TO_CONFIG_HASH[v.batchId] = v.configHash
}

export async function GET() {
  try {
    const res = await fetch(`${ORACLE_VISION_URL}/vision/batches`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    const data = await res.json()

    // Enrich: replace keccak256 hex source_id with human-readable name,
    // and inject correct configHash from deploy manifest (oracle DB may have stale zeros)
    for (const batch of (data.batches ?? [])) {
      const name = BATCH_ID_TO_SOURCE[batch.id]
      if (name) batch.source_id = name
      const deployConfigHash = BATCH_ID_TO_CONFIG_HASH[batch.id]
      if (deployConfigHash) batch.config_hash = deployConfigHash
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
