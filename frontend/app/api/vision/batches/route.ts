import { ISSUER_VISION_URL } from '@/lib/config'

export async function GET() {
  try {
    const res = await fetch(`${ISSUER_VISION_URL}/vision/batches`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()

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
