import { DATA_NODE_SERVER } from '@/lib/config'

const SAFE_HEX = /^#[0-9A-Fa-f]{3,8}$/
const SAFE_GRADIENT = /^linear-gradient\([^)]*\)$/
const SAFE_LOGO = /^\/(logos|source-imgs)\/[\w.-]+\.(svg|png|webp)$/

function sanitizeSource(s: any) {
  const bg = String(s.brandBg ?? '')
  return {
    ...s,
    name: String(s.name ?? '').replace(/[<>]/g, ''),
    description: String(s.description ?? '').replace(/[<>]/g, ''),
    brandBg: SAFE_HEX.test(bg) || SAFE_GRADIENT.test(bg) ? bg : '#888',
    logo: SAFE_LOGO.test(s.logo) ? s.logo : '/logos/default.svg',
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
