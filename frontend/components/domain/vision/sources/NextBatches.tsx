'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useBatches, type BatchInfo } from '@/hooks/vision/useBatches'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import Image from 'next/image'
import { Link } from '@/i18n/routing'

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

      {/* Footer: category */}
      <div className="flex items-center justify-between mt-3">
        <span className={`text-micro font-bold uppercase px-1.5 py-0.5 rounded ${catColors}`}>
          {item.category}
        </span>
        <span className="text-micro font-bold font-mono text-text-muted tabular-nums">
          #{item.batch.id}
        </span>
      </div>
    </Link>
  )
}

export function NextBatches() {
  const t = useTranslations('vision')
  const { data: apiBatches } = useBatches()
  const { sources: registrySources } = useSourceRegistry()

  const sortedBatches = useMemo((): BatchDisplay[] => {
    if (!apiBatches || apiBatches.length === 0) return []

    return apiBatches
      .filter(b => b.marketCount > 0)
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
        }
      })
      .sort((a, b) => b.batch.playerCount - a.batch.playerCount)
  }, [apiBatches, registrySources])

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
