import { keccak256, toHex } from 'viem'
import { getIssuerVisionUrl } from '@/lib/config'
import visionBatchesJson from '@/lib/contracts/vision-batches.json'
import sourcesDisplay from '@/data/sources-display.json'

// Static deploy configHash fallback: patches zero hashes from oracle
const BATCH_ID_TO_CONFIG_HASH: Record<number, string> = {}
for (const [, val] of Object.entries(visionBatchesJson.batches)) {
  const v = val as any
  if (v.configHash) BATCH_ID_TO_CONFIG_HASH[v.batchId] = v.configHash
}

// Build keccak hash → display sourceId lookup
// On-chain source_id = keccak256(internalId + "_v2") etc.
const HASH_TO_SOURCE: Record<string, string> = {}
for (const s of (sourcesDisplay as any).sources) {
  const ids: string[] = s.internalIds ?? [s.sourceId]
  for (const iid of ids) {
    for (const suffix of ['', '_v1', '_v2', '_v3', '_v4', '_v5']) {
      const hash = keccak256(toHex(iid + suffix)).toLowerCase()
      HASH_TO_SOURCE[hash] = s.sourceId
    }
    // Also map plain internal ID
    HASH_TO_SOURCE[iid.toLowerCase()] = s.sourceId
  }
}

function resolveSourceId(rawId: string): string {
  const lower = rawId.toLowerCase()
  return HASH_TO_SOURCE[lower] ?? rawId
}

export async function GET() {
  try {
    const res = await fetch(`${getIssuerVisionUrl()}/vision/batches`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()

    // Patch zero config hashes from static deploy output
    for (const batch of (data.batches ?? [])) {
      const isZeroHash = !batch.config_hash || batch.config_hash === '0x' + '0'.repeat(64)
      if (isZeroHash && BATCH_ID_TO_CONFIG_HASH[batch.id]) {
        batch.config_hash = BATCH_ID_TO_CONFIG_HASH[batch.id]
      }
    }

    // Resolve keccak hashes to display names and deduplicate
    for (const batch of (data.batches ?? [])) {
      batch.source_id = resolveSourceId(batch.source_id ?? '')
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
