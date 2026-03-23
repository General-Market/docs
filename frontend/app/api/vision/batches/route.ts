import { ISSUER_VISION_URL } from '@/lib/config'
import { keccak256, toHex } from 'viem'
import visionBatchesJson from '@/lib/contracts/vision-batches.json'
import sourcesData from '@/data/sources-display.json'

// Reverse map: batchId → human-readable source key + deploy configHash
const BATCH_ID_TO_SOURCE: Record<number, string> = {}
const BATCH_ID_TO_CONFIG_HASH: Record<number, string> = {}
for (const [key, val] of Object.entries(visionBatchesJson.batches)) {
  const v = val as any
  BATCH_ID_TO_SOURCE[v.batchId] = key
  if (v.configHash) BATCH_ID_TO_CONFIG_HASH[v.batchId] = v.configHash
}

// Fallback: resolve keccak256(name_vN) hashes for lifecycle-created batches
const HASH_TO_SOURCE: Record<string, string> = {}
for (const source of (sourcesData as any).sources ?? []) {
  const sid = source.sourceId ?? ''
  for (const iid of source.internalIds ?? []) {
    for (const suffix of ['', '_v1', '_v2', '_v3', '_v4', '_v5']) {
      const hash = keccak256(toHex(iid + suffix)).toLowerCase()
      HASH_TO_SOURCE[hash] = sid
    }
  }
}

function resolveSourceId(batchId: number, rawSourceId: string): string {
  // First try static deploy mapping
  const staticName = BATCH_ID_TO_SOURCE[batchId]
  if (staticName) return staticName
  // Fallback: resolve keccak hash to display name
  if (rawSourceId?.startsWith('0x') && rawSourceId.length > 10) {
    return HASH_TO_SOURCE[rawSourceId.toLowerCase()] ?? rawSourceId
  }
  return rawSourceId
}

export async function GET() {
  try {
    const res = await fetch(`${ISSUER_VISION_URL}/vision/batches`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()

    // Enrich: replace keccak256 hex source_id with human-readable name + inject deploy configHash
    for (const batch of (data.batches ?? [])) {
      batch.source_id = resolveSourceId(batch.id, batch.source_id ?? '')
      // Inject configHash from deploy output when oracle returns zero hash
      const isZeroHash = !batch.config_hash || batch.config_hash === '0x' + '0'.repeat(64)
      if (isZeroHash && BATCH_ID_TO_CONFIG_HASH[batch.id]) {
        batch.config_hash = BATCH_ID_TO_CONFIG_HASH[batch.id]
      }
    }

    // Deduplicate: keep latest NON-PAUSED batch per source (highest ID = most recent round)
    const latestPerSource = new Map<string, any>()
    for (const batch of (data.batches ?? []).filter((b: any) => !b.paused)) {
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
