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
  if (!bettingEnd) return null
  if (remaining <= 0) return <span className="text-micro text-amber-600 font-bold animate-pulse">New round soon</span>
  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  return <span className="text-micro font-bold font-mono tabular-nums text-text-muted">{m}:{s.toString().padStart(2, '0')}</span>
}

/** Category color mapping for the pill badges */
const CATEGORY_COLORS: Record<string, string> = {
  finance:       'bg-blue-50 text-blue-700',
  economic:      'bg-amber-50 text-amber-700',
  regulatory:    'bg-purple-50 text-purple-700',
  tech:          'bg-cyan-50 text-cyan-700',
  academic:      'bg-indigo-50 text-indigo-700',
  entertainment: 'bg-pink-50 text-pink-700',
  geophysical:   'bg-orange-50 text-orange-700',
  transport:     'bg-teal-50 text-teal-700',
  nature:        'bg-emerald-50 text-emerald-700',
  space:         'bg-violet-50 text-violet-700',
}

interface BatchDisplay {
  batch: BatchInfo
  logo?: string
  displayName: string
  category: string
  sourceKey: string
  bettingEnd: string | null
}

function BatchCard({ item }: { item: BatchDisplay }) {
  const catColors = CATEGORY_COLORS[item.category] ?? 'bg-gray-50 text-gray-700'

  return (
    <Link
      href={`/source/${item.sourceKey}`}
      className="shrink-0 flex flex-col px-5 py-4 border bg-white transition-all w-[220px] cursor-pointer border-border-light hover:border-black"
    >
      {/* Source name */}
      <div className="flex items-center gap-2 mb-2 min-w-0">
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

      {/* Player count */}
      <span className="text-stat font-black tabular-nums leading-none font-mono text-black">
        {item.batch.playerCount}
      </span>
      <span className="text-micro text-text-muted mt-1">players</span>

      {/* Footer: category + timer */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-micro font-bold uppercase px-1.5 py-0.5 rounded ${catColors}`}>
          {item.category}
        </span>
        <BatchTimer bettingEnd={item.bettingEnd} />
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

    // Build batchId → bettingEnd from rounds
    const roundMap = new Map<number, string>()
    if (rounds) {
      for (const r of rounds) {
        if (r.bettingEnd) roundMap.set(r.batchId, r.bettingEnd)
      }
    }

    return apiBatches
      .filter(b => b.marketCount > 0 && !b.paused)
      .map(batch => {
        const source = findSource(registrySources, batch.sourceId)
        const displayName = source?.name ?? batch.sourceId
        const logo = source?.logo
        const category = source?.category ?? 'finance'

        return {
          batch,
          logo,
          displayName,
          category,
          sourceKey: source?.sourceId ?? batch.sourceId,
          bettingEnd: roundMap.get(batch.id) ?? null,
        }
      })
      .sort((a, b) => b.batch.playerCount - a.batch.playerCount)
  }, [apiBatches, registrySources, rounds])

  if (sortedBatches.length === 0) return null

  return (
    <div className="px-6 lg:px-12">
      <div className="max-w-site mx-auto">
        <div className="flex items-center justify-between pt-4 pb-2">
          <div className="text-micro font-bold uppercase tracking-[0.08em] text-text-muted">
            {t('next_batches.live_batches')}
          </div>
          <div className="flex items-center gap-3 text-micro font-semibold text-text-muted">
            <span>{t('next_batches.batches_count', { count: sortedBatches.length })}</span>
          </div>
        </div>

        <div
          className="flex gap-2 pb-4 overflow-x-auto"
          style={{ scrollbarWidth: 'thin' }}
        >
          {sortedBatches.map((item) => (
            <BatchCard key={item.batch.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
