'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type MarketState,
  type UpcomingSlot,
  useUpcomingSlots,
  useMarketStatesBatch,
  useResolvedSlots,
} from '@/lib/markets/hooks'
import { MarketRow, type Side } from './MarketRow'
import { MarketRowSkeleton } from './MarketRowSkeleton'
import { CountdownTickProvider, useNowSecs } from './CountdownTimer'
import type { BoardFilter, HorizonFilter } from './FilterBar'
import type { StatusFilter } from './CategorySidebar'

const SKELETON_COUNT = 6

// Center column. A list of fat market rows. Replaces the seven-column
// calendar on the home page; the calendar still exists for any nostalgic
// future view.

export interface MarketListProps {
  board: BoardFilter
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
  board,
  horizon,
  statuses,
  selectedPda,
  selectedSide,
  onSelectSide,
  onSlotsChange,
}: MarketListProps) {
  const horizonDays = horizon === 'today' ? 1 : horizon === '7d' ? 7 : 30
  const upcomingSlots = useUpcomingSlots({
    board,
    horizonDays,
  })

  // Resolved markets live in the indexer, not in the forward-looking
  // cohort grid. Pull them only when the user actually asked for them.
  const wantsResolved = statuses.includes('resolved')
  const resolved = useResolvedSlots({
    limit: 60,
    board,
  })
  const resolvedSlots = wantsResolved ? resolved.slots : EMPTY_SLOTS
  const resolvedStates = wantsResolved ? resolved.states : EMPTY_STATES

  const upcomingPdas = useMemo(
    () => upcomingSlots.map(s => s.marketPda),
    [upcomingSlots],
  )
  const upcomingStateMap = useMarketStatesBatch(upcomingPdas)

  const now = useNowSecs()

  // Decide which universe powers the row list. Resolved-only swaps the
  // source. Mixed (resolved + live/open) unions both. Everything else
  // keeps the forward-only path.
  const onlyResolved = statuses.length === 1 && statuses[0] === 'resolved'
  const filteredSlots = useMemo<UpcomingSlot[]>(() => {
    if (onlyResolved) return resolvedSlots
    const forward = statuses.length === 0
      ? upcomingSlots
      : upcomingSlots.filter(s => {
          const st = upcomingStateMap[s.marketPda] ?? null
          const closed = now > 0 && s.closeTime <= now
          const isResolved = !!st?.resolved
          const hasPool = !!st && st.totalYes + st.totalNo > 0n
          const isLive = !closed && !isResolved && hasPool
          const isOpen = !closed && !isResolved && !hasPool
          if (statuses.includes('live') && isLive) return true
          if (statuses.includes('open') && isOpen) return true
          if (statuses.includes('resolved') && isResolved) return true
          return false
        })
    if (!wantsResolved || resolvedSlots.length === 0) return forward
    // Union: forward first (active markets), resolved (history) tail.
    // Dedupe by PDA in case the indexer has caught up but the chain
    // account still decodes the same row as the forward universe.
    const seen = new Set(forward.map(s => s.marketPda))
    const tail = resolvedSlots.filter(s => !seen.has(s.marketPda))
    return [...forward, ...tail]
  }, [
    onlyResolved,
    resolvedSlots,
    statuses,
    upcomingSlots,
    upcomingStateMap,
    wantsResolved,
    now,
  ])

  // Merged state map — resolved entries come from the indexer fetch;
  // forward entries come from the on-chain batch read.
  const stateMap = useMemo<Record<string, MarketState | null>>(() => {
    if (!wantsResolved) return upcomingStateMap
    return { ...upcomingStateMap, ...resolvedStates }
  }, [upcomingStateMap, resolvedStates, wantsResolved])

  // Lift the *forward* slot universe so the sidebar's per-board counts
  // don't lurch when the user flips the resolved checkbox. Counts read
  // "what's open right now", not "what existed across all of history".
  useNotifyParent(upcomingSlots, onSlotsChange)

  // Hydration gate. Until the first effect tick fires we cannot trust
  // an empty universe to mean "empty" — it might just mean "not yet
  // computed on the client". Render skeletons in that window.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const liveCount = filteredSlots.length
  const headingMode: HeadingMode = onlyResolved ? 'resolved' : 'upcoming'

  if (!mounted) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading mode={headingMode} liveCount={0} />
        <div className="space-y-2">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  // Resolved-only path: a still-loading indexer should show skeletons,
  // not "no markets here". The forward universe being non-empty doesn't
  // help us answer the resolved question.
  if (onlyResolved && resolved.loading && resolvedSlots.length === 0) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading mode={headingMode} liveCount={0} />
        <div className="space-y-2">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (filteredSlots.length === 0) {
    const text = onlyResolved
      ? 'Nothing has settled yet. Come back after the next window.'
      : upcomingSlots.length === 0
        ? 'No markets here. Try a wider source or horizon.'
        : 'No markets match the current filter.'
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading mode={headingMode} liveCount={0} />
        <EmptyState text={text} />
      </section>
    )
  }

  return (
    <section aria-label="Markets" className="min-w-0">
      <Heading mode={headingMode} liveCount={liveCount} />
      <FadeIn className="space-y-2">
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

// Stable empty references — handed back when the resolved feed is off so
// the upstream memo doesn't churn on every render.
const EMPTY_SLOTS: UpcomingSlot[] = []
const EMPTY_STATES: Record<string, MarketState | null> = {}

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

type HeadingMode = 'upcoming' | 'resolved'

function Heading({ mode, liveCount }: { mode: HeadingMode; liveCount: number }) {
  const title = mode === 'resolved' ? 'Already settled' : 'Closing soon'
  const subtitle = mode === 'resolved'
    ? 'The window closed. The price decided. The keeper paid.'
    : 'Pick a side. The keeper pays out when the answer arrives.'
  return (
    <header className="mb-5 flex items-baseline justify-between gap-3">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-100">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          {subtitle}
        </p>
      </div>
      <span className="text-[12px] tabular-nums text-zinc-500">
        <span className="font-medium text-zinc-200">{liveCount}</span>
        {liveCount === 1 ? ' market' : ' markets'}
      </span>
    </header>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-16 text-center">
      <p className="text-[14px] text-zinc-400">{text}</p>
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
