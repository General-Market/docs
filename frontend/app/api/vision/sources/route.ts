import { getDataNodeServer } from '@/lib/config'
import visionBatches from '@/lib/contracts/vision-batches.json'
import sourcesDisplay from '@/data/sources-display.json'

// Names of all deployed batches — the only sources worth showing users.
const DEPLOYED_BATCH_NAMES = new Set(Object.keys(visionBatches.batches))

// Build internalIds lookup from static sources-display.json
// (data-node doesn't populate this field)
const INTERNAL_IDS_MAP: Record<string, string[]> = {}
for (const s of (sourcesDisplay as any).sources) {
  const ids: string[] = (s as any).internalIds ?? []
  if (ids.length > 0) INTERNAL_IDS_MAP[s.sourceId] = ids
}

function sanitizeSource(s: any) {
  // Merge internalIds from static config if API doesn't provide them
  const internalIds = (s.internalIds?.length > 0) ? s.internalIds : (INTERNAL_IDS_MAP[s.sourceId] ?? [s.sourceId])
  return {
    ...s,
    internalIds,
    name: String(s.name ?? '').replace(/[<>]/g, ''),
    description: String(s.description ?? '').replace(/[<>]/g, ''),
    brandBg: /^(#[0-9A-Fa-f]{3,8}|linear-gradient\(.+\))$/.test(s.brandBg) ? s.brandBg : '#888',
    logo: /^\/(source-imgs|logos)\/[\w.-]+\.(svg|png|webp)$/.test(s.logo) ? s.logo : '/source-imgs/default.png',
  }
}

function hasDeployedBatch(source: any): boolean {
  if (DEPLOYED_BATCH_NAMES.has(source.sourceId)) return true
  if (Array.isArray(source.internalIds)) {
    return source.internalIds.some((id: string) => DEPLOYED_BATCH_NAMES.has(id))
  }
  return false
}

export async function GET() {
  try {
    const res = await fetch(`${getDataNodeServer()}/sources/registry`, { next: { revalidate: 300 } })
    if (!res.ok) return Response.json({ sources: [], categories: [] }, { status: 502 })
    const data = await res.json()
    const sources = (data.sources ?? [])
      .filter(hasDeployedBatch)
      .map(sanitizeSource)
    return Response.json({
      sources,
      categories: data.categories ?? [],
    })
  } catch {
    return Response.json({ sources: [], categories: [] }, { status: 502 })
  }
}
