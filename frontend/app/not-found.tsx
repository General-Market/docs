import Link from 'next/link'
import { getSourceRegistryServer } from '@/lib/vision/sources-server'
import { isHiddenSource } from '@/lib/vision/hidden-sources'

// Markets we'd happily send a lost reader to. Validated against the live
// registry below, so a suggestion is never a feed that's since gone dark.
const PREFERRED = ['polymarket', 'hackernews', 'binance_spot', 'tmdb', 'github', 'twitch']

interface Suggestion {
  id: string
  name: string
  logo: string
}

async function getSuggestions(): Promise<Suggestion[]> {
  try {
    const reg = await getSourceRegistryServer()
    const byId = new Map(reg.sources.map(s => [s.sourceId, s]))
    const picked = PREFERRED.map(id => byId.get(id)).filter(
      (s): s is NonNullable<typeof s> => !!s && !isHiddenSource(s),
    )
    // Backfill from the live registry if a preferred pick has gone dark.
    if (picked.length < 6) {
      for (const s of reg.sources) {
        if (picked.length >= 6) break
        if (isHiddenSource(s) || picked.some(p => p.sourceId === s.sourceId)) continue
        if (!s.logo || s.audience === 'redirect') continue
        picked.push(s)
      }
    }
    return picked.slice(0, 6).map(s => ({ id: s.sourceId, name: s.name, logo: s.logo }))
  } catch {
    return []
  }
}

export default async function NotFound() {
  const suggestions = await getSuggestions()

  return (
    <main className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-center px-6 animate-fade-up max-w-[640px]">
        <h1 className="text-[72px] font-black tracking-tight text-black leading-none">404</h1>
        <p className="text-body text-text-secondary mt-3">
          This market isn&apos;t here. It may have closed, or never opened.
        </p>

        {suggestions.length > 0 && (
          <div className="mt-10">
            <p className="text-caption font-bold uppercase tracking-wide text-text-tertiary">
              Markets that are open
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {suggestions.map(s => (
                <Link
                  key={s.id}
                  href={`/source/${s.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-caption font-semibold text-black transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.logo} alt="" className="h-4 w-4 rounded-full object-cover" />
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sources"
            className="inline-block px-6 py-3 bg-black text-white text-caption font-bold hover:bg-zinc-800 transition-colors"
          >
            Browse all markets
          </Link>
          <Link
            href="/"
            className="inline-block px-6 py-3 text-caption font-bold text-text-secondary hover:text-black transition-colors"
          >
            Back to General Market
          </Link>
        </div>
      </div>
    </main>
  )
}
