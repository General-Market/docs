'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  type UpcomingSlot,
  type MarketState,
  useUpcomingSlots,
  useMarketStatesBatch,
} from '@/lib/markets/hooks.stub'
import { MarketCard } from './MarketCard'
import { BetSheet } from './BetSheet'
import { CountdownTickProvider } from './CountdownTimer'
import type { SourceFilter, HorizonFilter } from './FilterBar'

// Calendar of upcoming closes. Desktop: a seven-column wall of dates.
// Mobile: a vertical reading. The data is the same — only the geometry
// changes with the screen.

interface DayBucket {
  /** Local date label, e.g. "Today", "Wed Apr 30" */
  label: string
  /** YYYY-MM-DD key, used as React key */
  key: string
  slots: UpcomingSlot[]
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfLocalDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function dayLabel(date: Date, today: Date): string {
  const tomorrow = new Date(today.getTime() + DAY_MS)
  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function bucketize(slots: UpcomingSlot[], days: number): DayBucket[] {
  const today = startOfLocalDay(new Date())
  const buckets: DayBucket[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * DAY_MS)
    buckets.push({ label: dayLabel(d, today), key: dayKey(d), slots: [] })
  }

  for (const slot of slots) {
    const closeDate = startOfLocalDay(new Date(slot.closeTime * 1000))
    const idx = Math.round((closeDate.getTime() - today.getTime()) / DAY_MS)
    if (idx < 0 || idx >= days) continue
    buckets[idx].slots.push(slot)
  }

  for (const b of buckets) {
    b.slots.sort((a, b) => a.closeTime - b.closeTime)
  }
  return buckets
}

// Per-card pass-through. The parent batches all visible PDAs into a single
// getMultipleAccountsInfo call (every 30s) and threads each slot's snapshot
// down by prop. Cards stay dumb — they read state, they do not poll.
function CardWithState({
  slot,
  state,
  onSelect,
}: {
  slot: UpcomingSlot
  state: MarketState | null
  onSelect: (s: UpcomingSlot) => void
}) {
  return <MarketCard slot={slot} state={state} onSelect={onSelect} />
}

export interface MarketCalendarProps {
  source: SourceFilter
  horizon: HorizonFilter
}

export function MarketCalendar({ source, horizon }: MarketCalendarProps) {
  const horizonDays = horizon === 'today' ? 1 : horizon === '7d' ? 7 : 30
  const slots = useUpcomingSlots({
    source: source === 'all' ? 'all' : source,
    horizonDays,
  })

  const [selected, setSelected] = useState<UpcomingSlot | null>(null)

  // bucketize() reads `new Date()` for "today/tomorrow" labels — defer it to
  // post-mount so SSR and the first client render emit the same shell.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const days = horizon === 'today' ? 1 : 7
  const buckets = useMemo(
    () => (mounted ? bucketize(slots, days) : []),
    [mounted, slots, days],
  )

  // One batched account-info call for every visible slot. The hook handles
  // chunking (max 100 per call), polls every 30s, skips the network when
  // membership doesn't change.
  const visiblePdas = useMemo(
    () => slots.map(s => s.marketPda),
    [slots],
  )
  const stateMap = useMarketStatesBatch(visiblePdas)

  const isEmpty = mounted && buckets.every(b => b.slots.length === 0)

  return (
    <CountdownTickProvider>
      {isEmpty ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <p className="text-sm text-zinc-500">Nothing closes here today.</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-400">
            try a wider horizon
          </p>
        </div>
      ) : (
        <>
          {/* Mobile / tablet — vertical day-grouped list */}
          <div className="space-y-6 lg:hidden">
            {buckets.map(b => (
              b.slots.length === 0 ? null : (
                <section key={b.key}>
                  <header className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-zinc-900">{b.label}</h2>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
                      {b.slots.length} {b.slots.length === 1 ? 'market' : 'markets'}
                    </span>
                  </header>
                  <div className="space-y-3">
                    {b.slots.map(s => (
                      <CardWithState key={`${s.catalogId}:${s.closeTime}`} slot={s} state={stateMap[s.marketPda] ?? null} onSelect={setSelected} />
                    ))}
                  </div>
                </section>
              )
            ))}
          </div>

          {/* Desktop — seven-column grid (or one if horizon=today) */}
          <div
            className={[
              'hidden gap-3 lg:grid',
              horizon === 'today' ? 'lg:grid-cols-1' : 'lg:grid-cols-7',
            ].join(' ')}
          >
            {buckets.map(b => (
              <section key={b.key} className="flex min-w-0 flex-col gap-3">
                <header className="border-b border-zinc-200 pb-2">
                  <h2 className="text-[13px] font-semibold text-zinc-900">{b.label}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
                    {b.slots.length} {b.slots.length === 1 ? 'market' : 'markets'}
                  </p>
                </header>
                <div className="space-y-3">
                  {b.slots.length === 0 ? (
                    <p className="text-[11px] text-zinc-400">—</p>
                  ) : (
                    b.slots.map(s => (
                      <CardWithState key={`${s.catalogId}:${s.closeTime}`} slot={s} state={stateMap[s.marketPda] ?? null} onSelect={setSelected} />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <BetSheet slot={selected} onClose={() => setSelected(null)} />
    </CountdownTickProvider>
  )
}
