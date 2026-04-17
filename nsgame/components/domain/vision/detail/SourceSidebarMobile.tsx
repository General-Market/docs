'use client'

import { useMemo } from 'react'
import { Link } from '@/i18n/routing'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'

const SIDEBAR_EXCLUDED = new Set(['chaturbate', 'fourchan'])
const SIDEBAR_VIDEO = '/source-video/mountains-sidebar.mp4'

interface SourceSidebarMobileProps {
  currentSourceId: string
  category: string
}

/**
 * Mobile equivalent of SourceSidebar. Hidden at xl and up where the two
 * vertical sidebars take over. Same mountain b-roll, same card treatment,
 * but arranged as a horizontal snap-scroll strip that sits full-bleed.
 */
export function SourceSidebarMobile({ currentSourceId, category }: SourceSidebarMobileProps) {
  const { sources } = useSourceRegistry()
  const { data: meta } = useMarketSnapshotMeta()

  const mobileSources = useMemo(() => {
    if (!sources) return []
    const eligible = sources.filter(
      s => s.sourceId !== currentSourceId && !SIDEBAR_EXCLUDED.has(s.sourceId),
    )
    const sameCat = eligible.filter(s => s.category === category)
    const otherCat = eligible.filter(s => s.category !== category)
    const merged = [...sameCat, ...otherCat]
    return merged.slice(0, 6)
  }, [sources, category, currentSourceId])

  if (mobileSources.length === 0) return null

  return (
    <div className="lg:hidden relative overflow-hidden rounded-xl">
      {/* Background, same looping mountain b-roll as desktop */}
      <video
        src={SIDEBAR_VIDEO}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* White fade at bottom so the CTA has a calm landing */}
      <div
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
      />

      <div className="relative py-6">
        <div className="px-4 mb-3 text-[10px] font-bold tracking-[0.14em] uppercase text-white/80">
          More Sources
        </div>

        <div
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 px-4 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {mobileSources.map(source => {
            const count = meta?.assetCounts?.[source.sourceId] ?? 0
            return (
              <Link
                key={source.sourceId}
                href={`/source/${source.sourceId}`}
                className="group shrink-0 w-[140px] snap-start bg-[#0d1117]/80 backdrop-blur-sm rounded-lg py-4 flex flex-col items-center gap-2 hover:bg-[#0d1117]/90 transition-colors"
              >
                <img
                  src={`/source-imgs/icons/${source.sourceId}.png`}
                  alt={source.name}
                  className="w-12 h-12 rounded-full object-contain"
                />
                <div className="text-[12px] font-bold text-white text-center truncate max-w-full px-2">
                  {source.name}
                </div>
                {count > 0 && (
                  <div className="text-[10px] font-mono text-white/40 tabular-nums">
                    {count} markets
                  </div>
                )}
              </Link>
            )
          })}
        </div>

        <div className="px-4 mt-1">
          <Link
            href="/vision"
            className="block w-full bg-white/90 hover:bg-white rounded-lg py-3 text-center text-[12px] font-black uppercase tracking-wider text-black transition-colors"
          >
            Explore Markets
          </Link>
        </div>
      </div>
    </div>
  )
}
