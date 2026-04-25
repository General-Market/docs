'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type UpcomingSlot,
  useUpcomingSlots,
  useMarketStatesBatch,
} from '@/lib/markets/hooks'
import { MarketRow, type Side } from './MarketRow'
import { MarketRowSkeleton } from './MarketRowSkeleton'
import { CountdownTickProvider, useNowSecs } from './CountdownTimer'
import type { SourceFilter, HorizonFilter } from './FilterBar'
import type { StatusFilter } from './CategorySidebar'

const SKELETON_COUNT = 6

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

  // Hydration gate. Until the first effect tick fires we cannot trust
  // `slots.length === 0` to mean "empty" — it might just mean "not yet
  // computed on the client". Render skeletons in that window.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const liveCount = filteredSlots.length

  if (!mounted) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading liveCount={0} />
        <div className="space-y-2.5">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

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
      <FadeIn className="space-y-2.5">
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
      </FadeIn>
    </section>
  )
}

// Fade rows in once. A double-RAF flips opacity 0 → 1 after the browser
// has committed the initial paint — without it the transition collapses
// into a single frame and the user sees no fade at all.
function FadeIn({ children, className }: { children: React.ReactNode; className?: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let raf2 = 0
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
    }
  }, [])
  return (
    <div
      className={[
        'transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function Heading({ liveCount }: { liveCount: number }) {
  return (
    <header className="mb-5 flex items-baseline justify-between gap-3">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900">
          Closing soon
        </h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          Pick a side. The keeper pays out when the answer arrives.
        </p>
      </div>
      <span className="text-[12px] tabular-nums text-zinc-500">
        <span className="font-medium text-zinc-900">{liveCount}</span>
        {liveCount === 1 ? ' market' : ' markets'}
      </span>
    </header>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white px-6 py-16 text-center">
      <p className="text-[14px] text-zinc-500">{text}</p>
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
