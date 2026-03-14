import { NextResponse } from 'next/server'
import { ISSUER_VISION_URL } from '@/lib/config'
import batchConfig from '@/lib/contracts/vision-batches.json'

const ISSUER_URL = ISSUER_VISION_URL

// Build reverse lookup: configHash → source name from vision-batches.json.
// configHash is stable across redeployments (batch IDs change, configHash does not).
const configHashToSource: Record<string, string> = {}
for (const [sourceId, entry] of Object.entries(batchConfig.batches as Record<string, { batchId: number; configHash: string }>)) {
  configHashToSource[entry.configHash] = sourceId
}

export async function GET() {
  try {
    const res = await fetch(`${ISSUER_URL}/vision/batches`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()

    // Enrich source_id using configHash (stable across redeployments).
    // When multiple batches share the same configHash (reruns), keep only the
    // latest (highest id) so the frontend sees one active batch per source.
    const allBatches: any[] = (data.batches ?? []).map((b: any) => ({
      ...b,
      source_id: configHashToSource[b.config_hash] ?? b.source_id,
    }))

    // Deduplicate: one batch per source_id, prefer highest id (latest deployment)
    const latestBySource = new Map<string, any>()
    for (const b of allBatches) {
      const key = b.source_id ?? b.id
      const existing = latestBySource.get(key)
      if (!existing || b.id > existing.id) {
        latestBySource.set(key, b)
      }
    }
    const batches = Array.from(latestBySource.values())

    return NextResponse.json({ batches })
  } catch (err) {
    console.error('Vision batches proxy error:', err)
    return NextResponse.json({ batches: [] }, { status: 502 })
  }
}
