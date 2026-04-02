'use client'

import { useMemo } from 'react'
import { Link } from '@/i18n/routing'
import { useSourceRegistry } from '@/hooks/vision/useSourceRegistry'
import { useMarketSnapshotMeta } from '@/hooks/vision/useMarketSnapshot'
import { getCategoryLabel } from '@/lib/vision/source-categories'

interface SourceSidebarProps {
  currentSourceId: string
  category: string
}

export function SourceSidebar({ currentSourceId, category }: SourceSidebarProps) {
  const { sources } = useSourceRegistry()
  const { data: meta } = useMarketSnapshotMeta()

  const otherSources = useMemo(() => {
    if (!sources) return []
    return sources
      .filter(s => s.category === category && s.sourceId !== currentSourceId)
      .slice(0, 10)
  }, [sources, category, currentSourceId])

  const categoryLabel = getCategoryLabel(category)

  return (
    <div className="w-[220px] shrink-0 hidden xl:block">
      {/* Banner — gradient with grid overlay, mimics HLTV sponsor sidebar */}
      <div className="relative h-[320px] overflow-hidden bg-gradient-to-b from-[#0a1628] via-[#162d50] to-[#0a1628]">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full bg-blue-500/[0.06] blur-3xl" />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
          <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
            <svg
              className="w-7 h-7 text-blue-400/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.01 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.01-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div className="text-[22px] font-black text-white/80 tracking-[-0.03em]">
            VISION
          </div>
          <div className="text-[9px] font-bold text-blue-400/50 uppercase tracking-[0.2em] mt-1">
            Prediction Markets
          </div>
          <p className="mt-5 text-[10px] text-white/15 text-center leading-relaxed">
            Trade on real-world data feeds. Every market settles automatically via BLS oracle consensus.
          </p>
        </div>
      </div>

      {/* Related sources — like HLTV match odds sidebar */}
      <div className="bg-[#0d1117]">
        <div className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/20 border-t border-white/[0.04]">
          More {categoryLabel}
        </div>
        <div className="divide-y divide-white/[0.03]">
          {otherSources.map(source => {
            const count = meta?.assetCounts?.[source.sourceId] ?? 0
            return (
              <Link
                key={source.sourceId}
                href={`/source_2/${source.sourceId}`}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.03] transition-colors group"
              >
                <img
                  src={source.logo}
                  alt=""
                  className="w-7 h-7 rounded object-contain bg-white/[0.05] p-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/55 group-hover:text-white/80 truncate font-semibold transition-colors">
                    {source.name}
                  </div>
                  {count > 0 && (
                    <div className="text-[9px] font-mono text-white/15 tabular-nums mt-0.5">
                      {count} markets
                    </div>
                  )}
                </div>
              </Link>
            )
          })}

          {otherSources.length === 0 && (
            <div className="px-3 py-4 text-[10px] text-white/15 text-center">
              No related sources
            </div>
          )}
        </div>

        <Link
          href="/sources"
          className="block px-3 py-3 text-center text-[11px] font-bold text-blue-400/60 hover:text-blue-400 transition-colors border-t border-white/[0.04]"
        >
          All Sources &rarr;
        </Link>
      </div>
    </div>
  )
}
