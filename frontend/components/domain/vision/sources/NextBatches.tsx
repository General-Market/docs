'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useBatches, type BatchInfo } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import Image from 'next/image'
import { Link } from '@/i18n/routing'

function BatchTimer({ bettingEnd }: { bettingEnd: string | null }) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!bettingEnd) return
    const update = () => setRemaining(Math.floor((new Date(bettingEnd).getTime() - Date.now()) / 1000))
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [bettingEnd])
  if (!bettingEnd || remaining <= 0) return null
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-color-up animate-pulse" />
      <span className="font-mono font-bold tabular-nums text-[13px] text-black tracking-tight">
        {m}:{s.toString().padStart(2, '0')}
      </span>
    </div>
  )
}

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
  isBettingOpen: boolean
  isSettling: boolean
}

function BatchCard({ item }: { item: BatchDisplay }) {
  const catColors = CATEGORY_COLORS[item.category] ?? 'bg-zinc-600/8 text-zinc-700'

  // Three visual states: betting (alive), settling (waiting), dormant
  const cardClasses = item.isBettingOpen
    ? 'border-l-[3px] border-l-black border-t border-r border-b border-border-light bg-white shadow-card hover:shadow-card-hover'
    : item.isSettling
      ? 'border-l-[3px] border-l-color-warning border-t border-r border-b border-border-light bg-surface-warning/40'
      : 'border border-border-light bg-white hover:border-border-medium'

  return (
    <Link
      href={`/source/${item.sourceKey}`}
      className={`shrink-0 flex flex-col w-[220px] cursor-pointer transition-all duration-150 ${cardClasses}`}
    >
      {/* Header: source name + category */}
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          {item.logo && (
            <Image
              src={item.logo}
              alt=""
              width={14}
              height={14}
              className="rounded-sm object-contain shrink-0"
            />
          )}
          <span className="text-label font-semibold text-text-secondary truncate leading-tight">
            {item.displayName}
          </span>
        </div>
      </div>

      {/* Body: stats */}
      <div className="px-4 pb-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-title font-black tabular-nums leading-none font-mono ${item.isSettling ? 'text-text-secondary' : 'text-black'}`}>
            {item.batch.playerCount}
          </span>
          <span className="text-micro font-mono text-text-muted tabular-nums">
            players
          </span>
        </div>
      </div>

      {/* Footer: state indicator */}
      <div className="mt-auto px-4 pb-3 pt-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-micro font-bold uppercase px-1.5 py-0.5 rounded ${catColors}`}>
            {item.category}
          </span>
          <span className="text-micro font-mono text-text-muted">
            #{item.batch.id}
          </span>
        </div>

        {item.isBettingOpen ? (
          <BatchTimer bettingEnd={item.bettingEnd} />
        ) : item.isSettling ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-color-warning opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-color-warning" />
            </span>
            <span className="text-micro font-bold font-mono text-color-warning">
              Settling
            </span>
          </div>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-border-medium" />
        )}
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

    // Build batchId → round info from rounds
    const roundMap = new Map<number, { bettingEnd: string | null; status: string }>()
    if (rounds) {
      for (const r of rounds) {
        roundMap.set(r.batchId, { bettingEnd: r.bettingEnd, status: r.status })
      }
    }

    return apiBatches
      .filter(b => b.marketCount > 0 && !b.paused)
      .map(batch => {
        const source = findSource(registrySources, batch.sourceId)
        const displayName = source?.name ?? batch.sourceId
        const logo = source?.logo
        const category = source?.category ?? 'finance'
        const roundInfo = roundMap.get(batch.id)
        const bettingEnd = roundInfo?.bettingEnd ?? null
        const isBettingOpen = bettingEnd ? new Date(bettingEnd).getTime() > now : false
        const isSettling = roundInfo?.status === 'settling' || (!isBettingOpen && !!bettingEnd)

        return {
          batch,
          logo,
          displayName,
          category,
          sourceKey: source?.sourceId ?? batch.sourceId,
          bettingEnd,
          isBettingOpen,
          isSettling,
        }
      })
      // Sort: betting open first, then settling, then by player count
      .sort((a, b) => {
        if (a.isBettingOpen !== b.isBettingOpen) return a.isBettingOpen ? -1 : 1
        if (a.isSettling !== b.isSettling) return a.isSettling ? -1 : 1
        return b.batch.playerCount - a.batch.playerCount
      })
  }, [apiBatches, registrySources, rounds])

  if (sortedBatches.length === 0) return null

  // Count by state
  const bettingCount = sortedBatches.filter(b => b.isBettingOpen).length
  const settlingCount = sortedBatches.filter(b => b.isSettling && !b.isBettingOpen).length

  return (
    <div className="px-6 lg:px-12">
      <div className="max-w-site mx-auto">
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="text-micro font-bold uppercase tracking-[0.08em] text-text-muted">
            {t('next_batches.live_batches')}
          </div>
          <div className="flex items-center gap-3 text-micro font-mono text-text-muted">
            {bettingCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-color-up" />
                {bettingCount} open
              </span>
            )}
            {settlingCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-color-warning" />
                {settlingCount} settling
              </span>
            )}
          </div>
        </div>

        <div
          className="flex gap-2 pb-4 overflow-x-auto scrollbar-hide"
        >
          {sortedBatches.map((item) => (
            <BatchCard key={item.batch.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
