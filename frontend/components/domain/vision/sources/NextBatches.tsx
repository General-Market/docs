'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useBatches, type BatchInfo } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import Image from 'next/image'
import { Link } from '@/i18n/routing'
import { CountdownRing } from '../CountdownRing'

/** Category color mapping */
const CATEGORY_COLORS: Record<string, string> = {
  finance:       'bg-blue-600/8 text-blue-700',
  economic:      'bg-amber-600/8 text-amber-700',
  regulatory:    'bg-purple-600/8 text-purple-700',
  tech:          'bg-cyan-600/8 text-cyan-700',
  academic:      'bg-indigo-600/8 text-indigo-700',
  entertainment: 'bg-pink-600/8 text-pink-700',
  geophysical:   'bg-orange-600/8 text-orange-700',
  transport:     'bg-teal-600/8 text-teal-700',
  nature:        'bg-emerald-600/8 text-emerald-700',
  space:         'bg-violet-600/8 text-violet-700',
}

interface BatchDisplay {
  batch: BatchInfo
  logo?: string
  displayName: string
  category: string
  sourceKey: string
  bettingEnd: string | null
  tickDuration: number
  isBettingOpen: boolean
  isSettling: boolean
}

function BatchCard({ item }: { item: BatchDisplay }) {
  const catColors = CATEGORY_COLORS[item.category] ?? 'bg-zinc-600/8 text-text-secondary'

  if (item.isBettingOpen) {
    return (
      <Link
        href={`/source/${item.sourceKey}`}
        className="shrink-0 flex flex-col w-[220px] cursor-pointer transition-all duration-150
          border-l-[3px] border-l-black border-t border-r border-b border-border-light bg-white
          shadow-card hover:shadow-card-hover hover:-translate-y-px"
      >
        {/* Source identity */}
        <div className="px-4 pt-3.5 pb-1">
          <div className="flex items-center gap-2 min-w-0">
            {item.logo && (
              <Image src={item.logo} alt={item.displayName} width={14} height={14} className="rounded-sm object-contain shrink-0" />
            )}
            <span className="text-label font-semibold text-text-secondary truncate leading-tight">
              {item.displayName}
            </span>
          </div>
        </div>

        {/* Timer ring — the hero element */}
        <div className="px-4 py-2 flex items-center justify-between">
          <CountdownRing
            bettingEnd={item.bettingEnd}
            tickDuration={item.tickDuration}
            size={48}
            strokeWidth={3}
          />
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              <span className="w-[6px] h-[6px] rounded-full bg-color-up animate-pulse" />
              <span className="text-micro font-bold text-color-up uppercase">Live</span>
            </div>
            <span className="text-title font-black font-mono tabular-nums text-black leading-none">
              {item.batch.playerCount}
            </span>
            <span className="text-micro text-text-muted">players</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 pb-3 flex items-center justify-between border-t border-border-light/60 pt-2">
          <span className={`text-micro font-bold uppercase px-1.5 py-0.5 rounded ${catColors}`}>
            {item.category}
          </span>
          <span className="text-micro font-mono text-text-muted tabular-nums">
            #{item.batch.id}
          </span>
        </div>
      </Link>
    )
  }

  if (item.isSettling) {
    return (
      <Link
        href={`/source/${item.sourceKey}`}
        className="shrink-0 flex flex-col w-[220px] cursor-pointer transition-all duration-150
          border border-color-warning/30 bg-surface-warning/30 hover:bg-surface-warning/50"
      >
        {/* Source identity */}
        <div className="px-4 pt-3.5 pb-1">
          <div className="flex items-center gap-2 min-w-0">
            {item.logo && (
              <Image src={item.logo} alt={item.displayName} width={14} height={14} className="rounded-sm object-contain shrink-0 opacity-60" />
            )}
            <span className="text-label font-semibold text-text-muted truncate leading-tight">
              {item.displayName}
            </span>
          </div>
        </div>

        {/* Settling state — centered label */}
        <div className="px-4 py-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-warning opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-color-warning" />
          </span>
          <span className="text-[15px] font-black font-mono text-color-warning tracking-tight">
            Settling
          </span>
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 pb-3 flex items-center justify-between pt-1">
          <span className={`text-micro font-bold uppercase px-1.5 py-0.5 rounded ${catColors} opacity-60`}>
            {item.category}
          </span>
          <span className="text-caption font-mono text-text-muted tabular-nums">
            {item.batch.playerCount} in &middot; #{item.batch.id}
          </span>
        </div>
      </Link>
    )
  }

  // Dormant / no timer
  return (
    <Link
      href={`/source/${item.sourceKey}`}
      className="shrink-0 flex flex-col w-[220px] cursor-pointer transition-all duration-150
        border border-border-light bg-white hover:border-border-medium"
    >
      <div className="px-4 pt-3.5 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          {item.logo && (
            <Image src={item.logo} alt={item.displayName} width={14} height={14} className="rounded-sm object-contain shrink-0" />
          )}
          <span className="text-label font-semibold text-text-secondary truncate leading-tight">
            {item.displayName}
          </span>
        </div>
      </div>
      <div className="px-4 py-2">
        <span className="text-title font-black tabular-nums leading-none font-mono text-black">
          {item.batch.playerCount}
        </span>
        <span className="text-micro font-mono text-text-muted ml-1.5">players</span>
      </div>
      <div className="mt-auto px-4 pb-3 flex items-center justify-between pt-1">
        <span className={`text-micro font-bold uppercase px-1.5 py-0.5 rounded ${catColors}`}>
          {item.category}
        </span>
        <span className="text-micro font-mono text-text-muted">#{item.batch.id}</span>
      </div>
    </Link>
  )
}

export function NextBatches() {
  const t = useTranslations('vision')
  const { data: apiBatches } = useBatches()
  const { sources: registrySources } = useSourceRegistry()
  const { data: rounds } = useRounds()

  const sortedBatches = useMemo((): BatchDisplay[] => {
    if (!apiBatches || apiBatches.length === 0) return []

    const now = Date.now()

    const roundMap = new Map<number, { bettingEnd: string | null; status: string; timeframeSecs: number }>()
    if (rounds) {
      for (const r of rounds) {
        roundMap.set(r.batchId, { bettingEnd: r.bettingEnd, status: r.status, timeframeSecs: r.timeframeSecs })
      }
    }

    return apiBatches
      .filter(b => !b.paused)
      .map(batch => {
        const source = findSource(registrySources, batch.sourceId)
        const displayName = source?.name ?? batch.sourceId
        const logo = source?.logo
        const category = source?.category ?? 'finance'
        const roundInfo = roundMap.get(batch.id)
        const bettingEnd = roundInfo?.bettingEnd ?? null
        const tickDuration = roundInfo?.timeframeSecs || batch.tickDuration || 300
        const isBettingOpen = bettingEnd ? new Date(bettingEnd).getTime() > now : false
        const isSettling = roundInfo?.status === 'settling' || (!isBettingOpen && !!bettingEnd)

        return { batch, logo, displayName, category, sourceKey: source?.sourceId ?? batch.sourceId, bettingEnd, tickDuration, isBettingOpen, isSettling }
      })
      .sort((a, b) => {
        if (a.isBettingOpen !== b.isBettingOpen) return a.isBettingOpen ? -1 : 1
        if (a.isSettling !== b.isSettling) return a.isSettling ? -1 : 1
        return b.batch.playerCount - a.batch.playerCount
      })
  }, [apiBatches, registrySources, rounds])

  if (sortedBatches.length === 0) return null

  const bettingCount = sortedBatches.filter(b => b.isBettingOpen).length
  const settlingCount = sortedBatches.filter(b => b.isSettling && !b.isBettingOpen).length

  return (
    <div className="px-6 lg:px-12">
      <div className="max-w-site mx-auto">
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="text-micro font-bold uppercase tracking-[0.08em] text-text-muted">
            {t('next_batches.live_batches')}
          </div>
          <div className="flex items-center gap-4 text-micro font-mono text-text-muted">
            {bettingCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-[6px] h-[6px] rounded-full bg-color-up" />
                <span className="font-bold text-black">{bettingCount}</span> open
              </span>
            )}
            {settlingCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-[6px] h-[6px] rounded-full bg-color-warning" />
                <span className="font-bold text-color-warning">{settlingCount}</span> settling
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 pb-4 overflow-x-auto scrollbar-hide">
          {sortedBatches.map((item) => (
            <BatchCard key={item.batch.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
