'use client'

import { useMemo } from 'react'
import { Link } from '@/i18n/routing'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'

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
    const sameCat = sources
      .filter(s => s.category === category && s.sourceId !== currentSourceId)
    const otherCat = sources
      .filter(s => s.category !== category && s.sourceId !== currentSourceId)

    if (side === 'left') {
      return sameCat.slice(0, 3)
    }
    const remaining = sameCat.slice(3, 6)
    if (remaining.length >= 3) return remaining
    return [...remaining, ...otherCat.slice(0, 3 - remaining.length)]
  }, [sources, category, currentSourceId, side])

  return (
    <div className="w-[300px] shrink-0 hidden 2xl:block self-start">
      {sidebarSources.map(source => {
        const count = meta?.assetCounts?.[source.sourceId] ?? 0
        return (
          <Link
            key={source.sourceId}
            href={`/source_2/${source.sourceId}`}
            className="group block relative overflow-hidden"
          >
            <div
              className="h-[200px] flex flex-col items-center justify-center gap-3 px-4"
              style={{ background: source.brandBg || '#0d0d0d' }}
            >
              <img
                src={source.logo}
                alt={source.name}
                className="w-14 h-14 rounded-lg object-contain drop-shadow-lg"
              />
              <div className="text-center">
                <div className="text-[13px] font-bold text-white group-hover:text-white/80 truncate max-w-[200px] transition-colors">
                  {source.name}
                </div>
                {count > 0 && (
                  <div className="text-[10px] font-mono text-white/30 tabular-nums mt-0.5">
                    {count} markets
                  </div>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
