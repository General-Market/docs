import Link from 'next/link'
import { getSourceRegistryServer } from '@/lib/vision/sources-server'
import { isHiddenSource } from '@/lib/vision/hidden-sources'
import { SourceLogo } from '@/components/ui/SourceLogo'

// Markets we'd happily send a lost reader to. Validated against the live
// registry below, so a suggestion is never a feed that's since gone dark.
const PREFERRED = ['polymarket', 'hackernews', 'binance_spot', 'tmdb', 'github', 'twitch']

// SF Pro stack per the Apple style guide (docs/apple-style-table.md). Inter and
// Helvetica Neue are the fallbacks.
const SF_PRO = '"SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Arial, sans-serif'

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
    <main
      className="min-h-screen bg-white flex items-center justify-center px-6"
      style={{ fontFamily: SF_PRO, letterSpacing: '-0.022em' }}
    >
      <div className="text-center animate-fade-up w-full" style={{ maxWidth: 600 }}>
        <p className="text-[19px] font-semibold text-[#86868b]">404</p>
        <h1 className="mt-2 text-[40px] sm:text-[48px] font-semibold leading-[1.08] text-[#1d1d1f]">
          This market isn&apos;t here.
        </h1>
        <p className="mt-3 text-[17px] leading-[1.47] text-[#6e6e73]">
          It may have closed, or never opened. These are open.
        </p>

        {suggestions.length > 0 && (
          <div className="mt-12">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
              Markets that are open
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {suggestions.map(s => (
                <Link
                  key={s.id}
                  href={`/source/${s.id}`}
                  className="inline-flex items-center gap-2 rounded-apple-pill border border-[#e8e8ed] bg-white py-[5px] pl-[5px] pr-[14px] text-[15px] font-medium text-[#1d1d1f] transition-colors duration-200 hover:border-[#d2d2d7] hover:bg-[#f5f5f7]"
                >
                  <SourceLogo logo={s.logo} name={s.name} size={26} />
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          <Link
            href="/sources"
            className="rounded-apple-pill bg-[#0071E3] px-[22px] py-[11px] text-[17px] text-white transition-colors duration-200 hover:bg-[#0077ED]"
          >
            Browse all markets
          </Link>
          <Link
            href="/"
            className="text-[17px] text-[#0071E3] transition-opacity duration-200 hover:opacity-70"
          >
            Back to General Market&nbsp;&rsaquo;
          </Link>
        </div>
      </div>
    </main>
  )
}
