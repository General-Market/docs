import { getDataNodeServer } from '@/lib/config'
import { isHiddenSource } from '@/lib/vision/hidden-sources'
import sourcesDisplay from '@/data/sources-display.json'

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

// Static overlay: display sources defined only in sources-display.json
// (e.g. the 18 DefiLlama human pages). The data-node doesn't know about
// these — they're editorial slices of an existing internal source. We
// merge them in here so the grid renders them. `audience: "bot"` and
// `"redirect"` entries are dropped from the public listing; they remain
// resolvable by direct URL via getSourceDisplayServer.
function staticOverlaySources(): any[] {
  const raw = (sourcesDisplay as { sources?: any[] }).sources ?? []
  return raw.filter(
    s => s.batchEligible === true
      && s.audience !== 'bot'
      && s.audience !== 'redirect'
      && !isHiddenSource(s),
  )
}

export async function GET() {
  try {
    const res = await fetch(`${getDataNodeServer()}/sources/registry`, { next: { revalidate: 60 } })
    if (!res.ok) {
      // Upstream down — at minimum serve the static overlay so the grid
      // doesn't collapse to empty.
      const overlay = staticOverlaySources().map(sanitizeSource)
      return Response.json({ sources: overlay, categories: [] }, { status: 502 })
    }
    const data = await res.json()
    // Index the static overlay by sourceId for fast editorial lookup.
    const allStatic = ((sourcesDisplay as { sources?: any[] }).sources ?? [])
    const staticById = new Map<string, any>(allStatic.map((s: any) => [s.sourceId, s]))

    const live = (data.sources ?? [])
      .filter((s: any) => s.batchEligible === true && !isHiddenSource(s))
      // Overlay editorial fields (audience, redirectTo) from the static JSON
      // onto every live entry. The data-node owns functional data; the static
      // file owns the human/bot/redirect routing decision.
      .map((s: any) => {
        const editorial = staticById.get(s.sourceId)
        if (editorial) {
          return {
            ...s,
            audience: editorial.audience ?? s.audience,
            redirectTo: editorial.redirectTo ?? s.redirectTo,
          }
        }
        return s
      })
      // Tag any defillama entry the data-node still advertises as a
      // redirect, so the grid doesn't show the old umbrella source.
      .map((s: any) => {
        if (s.sourceId === 'defillama') return { ...s, audience: 'redirect', redirectTo: 'defillama-tvl-all' }
        return s
      })
      .filter((s: any) => s.audience !== 'bot' && s.audience !== 'redirect')

    // Merge the static overlay, preferring live entries on sourceId collision.
    const seen = new Set<string>(live.map((s: any) => s.sourceId))
    const merged = [
      ...live,
      ...staticOverlaySources().filter(s => !seen.has(s.sourceId)),
    ].map(sanitizeSource)

    return Response.json({
      sources: merged,
      categories: data.categories ?? [],
    })
  } catch {
    const overlay = staticOverlaySources().map(sanitizeSource)
    return Response.json({ sources: overlay, categories: [] }, { status: 502 })
  }
}
