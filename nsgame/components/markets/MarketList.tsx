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
import { useUserPositions, type UserPosition } from '@/lib/markets/positions'
import { useWallet } from '@/hooks/useWallet'
import { getCatalogEntryByPairIndex } from '@/lib/markets/catalog'
import { MarketRow, type Side } from './MarketRow'
import { MarketRowSkeleton } from './MarketRowSkeleton'
import { CountdownTickProvider, useNowSecs } from './CountdownTimer'
import type { BoardFilter } from './FilterBar'
import type { StatusFilter } from './CategorySidebar'

const SKELETON_COUNT = 6

// Center column. A list of fat market rows. Status is the only time axis
// now — Live, Settling, or Resolved. The horizon concept died with the
// calendar.

// 30 days. The full forward universe — Status decides what shows.
const HORIZON_DAYS = 30

export interface MarketListProps {
  board: BoardFilter
  status: StatusFilter
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
  status,
  selectedPda,
  selectedSide,
  onSelectSide,
  onSlotsChange,
}: MarketListProps) {
  const upcomingSlots = useUpcomingSlots({
    board,
    horizonDays: HORIZON_DAYS,
  })

  // Settling and resolved both live in the indexer, not in the forward
  // cohort grid. Pull each only when the user actually asks for it.
  const wantsLive = status === 'live'
  const wantsSettling = status === 'settling'
  const wantsResolved = status === 'resolved'
  const wantsPositions = status === 'positions'

  const settling = useSettlingSlots({ limit: 60, board })
  const resolved = useResolvedSlots({ limit: 60, board })

  // Positions are derived from the connected wallet's bet history. Only
  // the rows where the user has skin survive the filter.
  const { address } = useWallet()
  const { positions, loading: positionsLoading } = useUserPositions(wantsPositions ? address : null)
  const positionRows = useMemo<{ slots: UpcomingSlot[]; states: Record<string, MarketState | null> }>(() => {
    if (!wantsPositions) return { slots: EMPTY_SLOTS, states: EMPTY_STATES }
    return positionsToSlots(positions, board)
  }, [wantsPositions, positions, board])

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

  // One status, one source. Live = forward catalog pruned to open windows;
  // Settling = indexer settling feed; Resolved = indexer resolved feed;
  // Positions = the wallet's slice across all of the above.
  const filteredSlots = useMemo<UpcomingSlot[]>(() => {
    if (wantsSettling) return settlingSlots
    if (wantsResolved) return resolvedSlots
    if (wantsPositions) return positionRows.slots
    // live: forward cohort with close still ahead.
    return upcomingSlots.filter(s => now <= 0 || s.closeTime > now)
  }, [
    wantsSettling,
    wantsResolved,
    wantsPositions,
    settlingSlots,
    resolvedSlots,
    positionRows.slots,
    upcomingSlots,
    now,
  ])

  // Merged state map — indexer-sourced rows take precedence over the
  // chain decode (the indexer has the canonical resolved/final values).
  const stateMap = useMemo<Record<string, MarketState | null>>(() => {
    if (wantsPositions) return { ...upcomingStateMap, ...positionRows.states }
    if (!wantsSettling && !wantsResolved) return upcomingStateMap
    return { ...upcomingStateMap, ...settlingStates, ...resolvedStates }
  }, [upcomingStateMap, settlingStates, resolvedStates, positionRows.states, wantsSettling, wantsResolved, wantsPositions])

  // Lift the *forward* slot universe so the sidebar's per-board counts
  // don't lurch when the user flips the resolved checkbox. Counts read
  // "what's open right now", not "what existed across all of history".
  useNotifyParent(upcomingSlots, onSlotsChange)

  // Hydration gate. Until the first effect tick fires we cannot trust
  // an empty universe to mean "empty" — it might just mean "not yet
  // computed on the client". Render skeletons in that window.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return (
      <section aria-label="Markets" className="min-w-0">
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
  if (wantsSettling && settling.loading && settlingSlots.length === 0) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <div className="space-y-2">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (wantsResolved && resolved.loading && resolvedSlots.length === 0) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <div className="space-y-2">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (wantsPositions && positionsLoading && positionRows.slots.length === 0) {
    return (
      <section aria-label="Markets" className="min-w-0">
        <div className="space-y-2">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <MarketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (filteredSlots.length === 0) {
    const text = wantsSettling
      ? 'Nothing waiting. Every closed window has been answered.'
      : wantsResolved
        ? 'Nothing has settled yet. Come back after the next window.'
        : wantsPositions
          ? address
            ? 'No positions yet. Place a bet — the ledger starts empty.'
            : 'Connect a wallet to see your positions.'
          : upcomingSlots.length === 0
            ? 'No markets here. Try a wider source.'
            : 'No markets match the current filter.'
    return (
      <section aria-label="Markets" className="min-w-0">
        <ListHeader status={status} count={0} live={wantsLive} />
        <EmptyState text={text} />
      </section>
    )
  }

  return (
    <section aria-label="Markets" className="min-w-0">
      <ListHeader status={status} count={filteredSlots.length} live={wantsLive} />
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

// Map the wallet's positions onto MarketRow's slot/state shape so the
// central column can render them with the same chrome the live feed
// uses. Resolved positions carry a synthetic state with the outcome
// flipped in; open ones leave state null and the row falls back to its
// audience prior.
function positionsToSlots(
  positions: ReadonlyArray<UserPosition>,
  board: BoardFilter,
): { slots: UpcomingSlot[]; states: Record<string, MarketState | null> } {
  const slots: UpcomingSlot[] = []
  const states: Record<string, MarketState | null> = {}

  for (const p of positions) {
    const entry = getCatalogEntryByPairIndex(p.thresholdBps)
    if (!entry) continue
    if (board !== 'all' && entry.board !== board) continue

    slots.push({
      catalogId: entry.id,
      sourceId: entry.sourceId,
      sourceName: entry.sourceName,
      label: entry.label,
      description: entry.description,
      thresholdBps: entry.thresholdBps,
      pairIndex: entry.pairIndex,
      board: entry.board,
      format: entry.format,
      displayA: entry.displayA,
      displayB: entry.displayB,
      slugA: entry.slugA,
      slugB: entry.slugB,
      audienceA: entry.audienceA,
      audienceB: entry.audienceB,
      windowSecs: entry.windowSecs,
      closeTime: p.closeTime,
      settlementTime: p.settlementTime,
      marketPda: p.market,
    })

    const isResolved =
      p.state === 'resolved-won' ||
      p.state === 'resolved-lost' ||
      p.state === 'claimed-won' ||
      p.state === 'claimed-lost' ||
      p.state === 'stranded-refund'

    if (isResolved) {
      // outcomeYes follows the user's bet outcome — won on YES means
      // YES is the winning side, and so on. Refund leaves it null.
      const won = p.state === 'resolved-won' || p.state === 'claimed-won'
      const refund = p.state === 'stranded-refund'
      const outcomeYes = refund
        ? null
        : (p.side === 'yes' ? won : !won)

      states[p.market] = {
        // Pool sums aren't carried on the position — leave them at the
        // bet amount as a floor. The MarketRow only needs them for the
        // tape footer; the row's main signals come from `resolved` and
        // `outcomeYes`.
        totalYes: p.side === 'yes' ? p.amount : 0n,
        totalNo: p.side === 'no' ? p.amount : 0n,
        resolved: true,
        outcomeYes,
        baselinePrice: p.baselinePrice,
        finalPrice: p.finalPrice,
      }
    } else {
      // open / settling — let the chain-decode batch fill it in.
      states[p.market] = null
    }
  }

  // Newest first — match the resolved/settling feeds.
  slots.sort((a, b) => b.closeTime - a.closeTime)
  return { slots, states }
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-16 text-center">
      <p className="text-[14px] text-zinc-400">{text}</p>
    </div>
  )
}

// Section header — eyebrow + bold declaration with a red period. The
// title shifts with the status; the live state earns a pulse dot to
// the right of the eyebrow.
function ListHeader({
  status,
  count,
  live,
}: { status: StatusFilter; count: number; live: boolean }) {
  const meta = HEADER_COPY[status]
  return (
    <header className="mb-3 flex items-end justify-between gap-3">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          {meta.eyebrow}
          {live ? (
            <span className="relative inline-flex h-[6px] w-[6px]" aria-hidden>
              <span className="absolute inset-0 inline-flex animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-red-500" />
            </span>
          ) : null}
        </p>
        <h2 className="text-[18px] font-semibold tracking-tight text-zinc-100">
          {meta.title}<span className="text-rose-500">.</span>
        </h2>
      </div>
      {count > 0 ? (
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          {count} {count === 1 ? 'row' : 'rows'}
        </span>
      ) : null}
    </header>
  )
}

const HEADER_COPY: Record<StatusFilter, { eyebrow: string; title: string }> = {
  live:      { eyebrow: 'markets · open',      title: 'Pick a side' },
  settling:  { eyebrow: 'markets · settling',  title: 'Awaiting the oracle' },
  resolved:  { eyebrow: 'markets · resolved',  title: 'The book is closed' },
  positions: { eyebrow: 'you · in flight',     title: 'Skin in the game' },
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
