import { getDataNodeServer } from '@/lib/config'
import visionBatches from '@/lib/contracts/vision-batches.json'

// Names of all deployed batches — the only sources worth showing users.
const DEPLOYED_BATCH_NAMES = new Set(Object.keys(visionBatches.batches))

function sanitizeSource(s: any) {
  return {
    ...s,
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
