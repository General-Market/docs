'use client'

import { useMemo } from 'react'
import { Link } from '@/i18n/routing'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'

const SIDEBAR_EXCLUDED = new Set(['chaturbate', 'fourchan'])
const SIDEBAR_VIDEO = '/source-video/mountains-sidebar.mp4'

interface SourceSidebarProps {
  currentSourceId: string
  category: string
  side: 'left' | 'right'
}

export function SourceSidebar({ currentSourceId, category, side }: SourceSidebarProps) {
  const { sources } = useSourceRegistry()
  const { data: meta } = useMarketSnapshotMeta()
  const sidebarSources = useMemo(() => {
    if (!sources) return []
    const eligible = sources.filter(
      s => s.sourceId !== currentSourceId && !SIDEBAR_EXCLUDED.has(s.sourceId),
    )
    const sameCat = eligible.filter(s => s.category === category)
    const otherCat = eligible.filter(s => s.category !== category)

    if (side === 'left') {
      return sameCat.slice(0, 3)
    }
    const remaining = sameCat.slice(3, 6)
    if (remaining.length >= 3) return remaining
    return [...remaining, ...otherCat.slice(0, 3 - remaining.length)]
  }, [sources, category, currentSourceId, side])

  return (
    <div className="w-[250px] shrink-0 hidden xl:block">
      {/* Fixed aspect ratio prevents layout shift when the video metadata loads
          (without it the box height jumps from 0 to natural video height,
          making the centered CTA visibly snap into place mid-scroll). */}
      <div className="relative aspect-[250/700] overflow-hidden">
        {/* Background — looping mountain b-roll, mirrored on right sidebar */}
        <video
          src={SIDEBAR_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: side === 'right' ? 'scaleX(-1)' : undefined,
          }}
        />

        {/* White fade at bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-[200px] pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
        />

        {/* Source cards + CTA — single contiguous block, centered, no dead space */}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 py-6">
          <div className="flex flex-col items-center gap-3 w-full">
            {sidebarSources.map(source => {
              const count = meta?.assetCounts?.[source.sourceId] ?? 0
              return (
                <Link
                  key={source.sourceId}
                  href={`/source/${source.sourceId}`}
                  className="group w-full bg-[#0d1117]/80 backdrop-blur-sm rounded-lg py-4 flex flex-col items-center gap-2 hover:bg-[#0d1117]/90 transition-colors"
                >
                  <img
                    src={`/source-imgs/icons/${source.sourceId}.png`}
                    alt={source.name}
                    className="w-12 h-12 rounded-full object-contain"
                  />
                  <div className="text-[13px] font-bold text-white text-center truncate max-w-full px-2">
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

            {/* CTA — sits directly beneath the source cards, never orphaned */}
            <Link
              href="/vision"
              className="w-full bg-white/90 hover:bg-white rounded-lg py-3 text-center text-[12px] font-black uppercase tracking-wider text-black transition-colors mt-1"
            >
              Explore Markets
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
