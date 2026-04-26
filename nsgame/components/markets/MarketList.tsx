'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type MarketState,
  type UpcomingSlot,
  useUpcomingSlots,
  useMarketStatesBatch,
  useResolvedSlots,
  useSettlingSlots,
} from '@/lib/markets/hooks'
import { MarketRow, type Side } from './MarketRow'
import { MarketRowSkeleton } from './MarketRowSkeleton'
import { CountdownTickProvider, useNowSecs } from './CountdownTimer'
import type { BoardFilter, HorizonFilter } from './FilterBar'
import type { StatusFilter } from './CategorySidebar'
import { headerForStatuses, type MarketStatus } from '@/lib/markets/status'

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

  // Settling and resolved both live in the indexer, not in the forward
  // cohort grid. Pull each only when the user actually asks for it.
  const wantsLive = statuses.length === 0 || statuses.includes('live')
  const wantsSettling = statuses.includes('settling')
  const wantsResolved = statuses.includes('resolved')

  const settling = useSettlingSlots({ limit: 60, board })
  const resolved = useResolvedSlots({ limit: 60, board })

  const settlingSlots = wantsSettling ? settling.slots : EMPTY_SLOTS
  const settlingStates = wantsSettling ? settling.states : EMPTY_STATES
  const resolvedSlots = wantsResolved ? resolved.slots : EMPTY_SLOTS
  const resolvedStates = wantsResolved ? resolved.states : EMPTY_STATES

  const upcomingPdas = useMemo(
    () => upcomingSlots.map(s => s.marketPda),
    [upcomingSlots],
  )
  const upcomingStateMap = useMarketStatesBatch(upcomingPdas)

  const now = useNowSecs()

  // Compose the row universe. Each toggle adds its own source; absence of
  // any toggle falls back to the forward-only "what's coming next" view.
  // Dedupe by PDA — a freshly-resolved market may still appear in the
  // forward cohort until the catalog rolls.
  const onlySettling = statuses.length === 1 && statuses[0] === 'settling'
  const onlyResolved = statuses.length === 1 && statuses[0] === 'resolved'

  const filteredSlots = useMemo<UpcomingSlot[]>(() => {
    if (onlySettling) return settlingSlots
    if (onlyResolved) return resolvedSlots

    // The "live" cohort is the forward catalog grid pruned to markets
    // whose close window has not yet passed (so an instantiated row that
    // crossed close-time but hasn't reached the indexer's settling fetch
    // doesn't ghost-render here).
    const liveSlots = !wantsLive
      ? EMPTY_SLOTS
      : statuses.length === 0
        ? upcomingSlots
        : upcomingSlots.filter(s => now <= 0 || s.closeTime > now)

    const out: UpcomingSlot[] = []
    const seen = new Set<string>()
    const push = (xs: readonly UpcomingSlot[]) => {
      for (const s of xs) {
        if (seen.has(s.marketPda)) continue
        seen.add(s.marketPda)
        out.push(s)
      }
    }
    push(liveSlots)
    if (wantsSettling) push(settlingSlots)
    if (wantsResolved) push(resolvedSlots)
    return out
  }, [
    onlySettling,
    onlyResolved,
    settlingSlots,
    resolvedSlots,
    statuses,
    upcomingSlots,
    wantsLive,
    wantsSettling,
    wantsResolved,
    now,
  ])

  // Merged state map — indexer-sourced rows take precedence over the
  // chain decode (the indexer has the canonical resolved/final values).
  const stateMap = useMemo<Record<string, MarketState | null>>(() => {
    if (!wantsSettling && !wantsResolved) return upcomingStateMap
    return { ...upcomingStateMap, ...settlingStates, ...resolvedStates }
  }, [upcomingStateMap, settlingStates, resolvedStates, wantsSettling, wantsResolved])

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
  // Translate the StatusFilter[] into MarketStatus[] for header copy.
  // The two enums are isomorphic by design — `lib/markets/status.ts` is
  // the canonical taxonomy, the UI checkbox values mirror it.
  const headerStatuses: MarketStatus[] = statuses
  const headerCopy = headerForStatuses(headerStatuses)

  if (!mounted) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading copy={headerCopy} liveCount={0} />
        <div className="space-y-2">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  // Indexer-only paths: while the request is in flight, render skeletons
  // instead of an unhelpful empty state. The forward universe cannot
  // answer either question.
  if (onlySettling && settling.loading && settlingSlots.length === 0) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading copy={headerCopy} liveCount={0} />
        <div className="space-y-2">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (onlyResolved && resolved.loading && resolvedSlots.length === 0) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading copy={headerCopy} liveCount={0} />
        <div className="space-y-2">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (filteredSlots.length === 0) {
    const text = onlySettling
      ? 'Nothing waiting. Every closed window has been answered.'
      : onlyResolved
        ? 'Nothing has settled yet. Come back after the next window.'
        : upcomingSlots.length === 0
          ? 'No markets here. Try a wider source or horizon.'
          : 'No markets match the current filter.'
    return (
      <section aria-label="Markets" className="min-w-0">
        <Heading copy={headerCopy} liveCount={0} />
        <EmptyState text={text} />
      </section>
    )
  }

  return (
    <section aria-label="Markets" className="min-w-0">
      <Heading copy={headerCopy} liveCount={liveCount} />
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

function Heading({ copy, liveCount }: { copy: { title: string; subtitle: string }; liveCount: number }) {
  return (
    <header className="mb-5 flex items-baseline justify-between gap-3">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-100">
          {copy.title}
        </h2>
        <p className="mt-1 text-[13px] text-zinc-500">
          {copy.subtitle}
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
