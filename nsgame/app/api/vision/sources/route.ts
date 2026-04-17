import { getDataNodeServer } from '@/lib/config'

function sanitizeSource(s: any) {
  return {
    ...s,
    internalIds: s.internalIds?.length > 0 ? s.internalIds : [s.sourceId],
    name: String(s.name ?? '').replace(/[<>]/g, ''),
    description: String(s.description ?? '').replace(/[<>]/g, ''),
    brandBg: /^(#[0-9A-Fa-f]{3,8}|linear-gradient\(.+\))$/.test(s.brandBg) ? s.brandBg : '#888',
    logo: /^\/(source-imgs|logos)\/[\w.-]+\.(svg|png|webp)$/.test(s.logo) ? s.logo : '/source-imgs/default.png',
  }
}

export async function GET() {
  try {
    const res = await fetch(`${getDataNodeServer()}/sources/registry`, { next: { revalidate: 60 } })
    if (!res.ok) return Response.json({ sources: [], categories: [] }, { status: 502 })
    const data = await res.json()
    // Filter by batchEligible from the data-node registry — no static JSON dependency.
    // Sources appear/disappear dynamically as the data-node enables them.
    const sources = (data.sources ?? [])
      .filter((s: any) => s.batchEligible === true)
      .map(sanitizeSource)
    return Response.json({
      sources,
      categories: data.categories ?? [],
    })
  } catch {
    return Response.json({ sources: [], categories: [] }, { status: 502 })
  }
}
