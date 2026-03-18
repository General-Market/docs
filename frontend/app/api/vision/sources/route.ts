import { DATA_NODE_SERVER } from '@/lib/config'

function sanitizeSource(s: any) {
  return {
    ...s,
    name: String(s.name ?? '').replace(/[<>]/g, ''),
    description: String(s.description ?? '').replace(/[<>]/g, ''),
    brandBg: /^#[0-9A-Fa-f]{3,8}$/.test(s.brandBg) ? s.brandBg : '#888',
    logo: /^\/logos\/[\w.-]+\.(svg|png|webp)$/.test(s.logo) ? s.logo : '/logos/default.svg',
  }
}

export async function GET() {
  try {
    const res = await fetch(`${DATA_NODE_SERVER}/sources/registry`, { next: { revalidate: 300 } })
    if (!res.ok) return Response.json({ sources: [], categories: [] }, { status: 502 })
    const data = await res.json()
    return Response.json({
      sources: (data.sources ?? []).map(sanitizeSource),
      categories: data.categories ?? [],
    })
  } catch {
    return Response.json({ sources: [], categories: [] }, { status: 502 })
  }
}
