'use client'

import { useEffect, useMemo, useRef } from 'react'
import {
  type UpcomingSlot,
  useUpcomingSlots,
  useMarketStatesBatch,
} from '@/lib/markets/hooks'
import { MarketRow, type Side } from './MarketRow'
import { CountdownTickProvider, useNowSecs } from './CountdownTimer'
import type { SourceFilter, HorizonFilter } from './FilterBar'
import type { StatusFilter } from './CategorySidebar'

// Center column. A list of fat market rows. Replaces the seven-column
// calendar on the home page; the calendar still exists for any nostalgic
// future view.

export interface MarketListProps {
  source: SourceFilter
  horizon: HorizonFilter
  statuses: StatusFilter[]
  selectedPda: string | null
  selectedSide: Side | null
  onSelectSide: (slot: UpcomingSlot, side: Side) => void
  onSlotsChange?: (slots: UpcomingSlot[]) => void
}

export function MarketList(props: MarketListProps) {
  return (
    <CountdownTickProvider>
      <MarketListInner {...props} />
    </CountdownTickProvider>
  )
}

function MarketListInner({
  source,
  horizon,
  statuses,
  selectedPda,
  selectedSide,
  onSelectSide,
  onSlotsChange,
}: MarketListProps) {
  const horizonDays = horizon === 'today' ? 1 : horizon === '7d' ? 7 : 30
  const slots = useUpcomingSlots({
    source: source === 'all' ? 'all' : source,
    horizonDays,
  })

  const visiblePdas = useMemo(() => slots.map(s => s.marketPda), [slots])
  const stateMap = useMarketStatesBatch(visiblePdas)

  const now = useNowSecs()

  // Status filter applied client-side. Cheap; the slot list is small.
  const filteredSlots = useMemo(() => {
    if (statuses.length === 0) return slots
    return slots.filter(s => {
      const st = stateMap[s.marketPda] ?? null
      const closed = now > 0 && s.closeTime <= now
      const resolved = !!st?.resolved
      const hasPool = !!st && st.totalYes + st.totalNo > 0n
      const isLive = !closed && !resolved && hasPool
      const isOpen = !closed && !resolved && !hasPool
      const isResolved = resolved
      if (statuses.includes('live') && isLive) return true
      if (statuses.includes('open') && isOpen) return true
      if (statuses.includes('resolved') && isResolved) return true
      return false
    })
  }, [slots, stateMap, statuses, now])

  // Lift the slot universe (pre-status-filter) so the sidebar can show
  // per-source counts that don't oscillate as status toggles flip.
  useNotifyParent(slots, onSlotsChange)

  const liveCount = filteredSlots.length

  if (slots.length > 0 && filteredSlots.length === 0) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading liveCount={0} />
        <EmptyState text="No markets match the current filter." />
      </section>
    )
  }

  if (slots.length === 0) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading liveCount={0} />
        <EmptyState text="No markets here. Try a wider source or horizon." />
      </section>
    )
  }

  return (
    <section aria-label="Markets" className="min-w-0">
      <Heading liveCount={liveCount} />
      <div className="space-y-3">
        {filteredSlots.map(slot => (
          <MarketRow
            key={`${slot.catalogId}:${slot.closeTime}`}
            slot={slot}
            state={stateMap[slot.marketPda] ?? null}
            selected={selectedPda === slot.marketPda}
            selectedSide={selectedPda === slot.marketPda ? selectedSide : null}
            onSelectSide={onSelectSide}
          />
        ))}
      </div>
    </section>
  )
}

function Heading({ liveCount }: { liveCount: number }) {
  return (
    <header className="mb-4 flex items-baseline justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900 sm:text-base">
          markets that close soon
        </h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">
          Pick a side. The keeper pays out when the answer arrives.
        </p>
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
        showing · <span className="tabular-nums text-zinc-900">{liveCount}</span>
      </span>
    </header>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  )
}

// Notify the parent of the latest slot universe so the sidebar can show
// counts. useUpcomingSlots returns a memoised array; identity changes once
// per minute (or when filters change), so the effect fires only then.
function useNotifyParent(
  slots: UpcomingSlot[],
  onSlotsChange: ((slots: UpcomingSlot[]) => void) | undefined,
) {
  const cbRef = useRef(onSlotsChange)
  useEffect(() => { cbRef.current = onSlotsChange }, [onSlotsChange])

  useEffect(() => {
    cbRef.current?.(slots)
  }, [slots])
}
