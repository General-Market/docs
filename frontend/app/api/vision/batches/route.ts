import { DATA_NODE_SERVER, ORACLE_VISION_URL } from '@/lib/config'
import visionBatchesJson from '@/lib/contracts/vision-batches.json'
import { toDisplayId } from '@/lib/vision/source-ids'

// Reverse maps from vision-batches.json: batchId → source name, batchId → configHash
const BATCH_ID_TO_SOURCE: Record<number, string> = {}
const BATCH_ID_TO_CONFIG_HASH: Record<number, string> = {}
for (const [key, val] of Object.entries(visionBatchesJson.batches)) {
  const v = val as any
  BATCH_ID_TO_SOURCE[v.batchId] = key
  if (v.configHash) BATCH_ID_TO_CONFIG_HASH[v.batchId] = v.configHash
}

/** Fetch market counts from data-node recommended batches, keyed by source name. */
async function fetchMarketCounts(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${DATA_NODE_SERVER}/batches/recommended`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return {}
    const data = await res.json()
    const batches = Array.isArray(data) ? data : data.batches ?? []
    const counts: Record<string, number> = {}
    for (const b of batches) {
      const src = b.sourceId ?? b.source_id
      if (src) counts[src] = (b.markets ?? []).length
    }
    return counts
  } catch {
    return {}
  }
}

export async function GET() {
  try {
    const [oracleRes, marketCounts] = await Promise.all([
      fetch(`${ORACLE_VISION_URL}/vision/batches`, {
        next: { revalidate: 5 },
        signal: AbortSignal.timeout(10_000),
      }),
      fetchMarketCounts(),
    ])
    if (!oracleRes.ok) throw new Error(`Oracle API ${oracleRes.status}`)
    const data = await oracleRes.json()

    // Enrich: replace keccak256 hex source_id with human-readable name,
    // inject correct configHash from deploy manifest, and inject market_count
    // from data-node (oracle config_hash matching is unreliable due to hash drift)
    for (const batch of (data.batches ?? [])) {
      const name = BATCH_ID_TO_SOURCE[batch.id]
      if (name) {
        batch.source_id = toDisplayId(name)
        batch.market_count = marketCounts[name] ?? batch.market_count ?? 0
      }
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
