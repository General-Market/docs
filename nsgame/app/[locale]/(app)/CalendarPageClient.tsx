'use client'

import { useCallback, useState } from 'react'
import { NavBar } from '@/components/markets/NavBar'
import { FilterBar, type SourceFilter, type HorizonFilter } from '@/components/markets/FilterBar'
import { CategorySidebar, type StatusFilter } from '@/components/markets/CategorySidebar'
import { MarketList } from '@/components/markets/MarketList'
import { BetTicket } from '@/components/markets/BetTicket'
import { BetSheet } from '@/components/markets/BetSheet'
import { StatStrip } from '@/components/markets/StatStrip'
import type { Side } from '@/components/markets/MarketRow'
import type { UpcomingSlot } from '@/lib/markets/hooks'

// Three columns on desktop. Sidebar, list, ticket. The bottom sheet is
// kept for mobile only — same logic, different geometry.

export function CalendarPageClient() {
  const [source, setSource] = useState<SourceFilter>('all')
  const [horizon, setHorizon] = useState<HorizonFilter>('7d')
  const [statuses, setStatuses] = useState<StatusFilter[]>([])

  const [selectedSlot, setSelectedSlot] = useState<UpcomingSlot | null>(null)
  const [selectedSide, setSelectedSide] = useState<Side>('yes')
  const [sheetSlot, setSheetSlot] = useState<UpcomingSlot | null>(null)

  const [allSlots, setAllSlots] = useState<UpcomingSlot[]>([])

  const handleStatusToggle = useCallback((s: StatusFilter) => {
    setStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s],
    )
  }, [])

  const handleSelectSide = useCallback((slot: UpcomingSlot, side: Side) => {
    setSelectedSlot(slot)
    setSelectedSide(side)
    // On mobile the right rail isn't visible — open the bottom sheet too.
    // CSS hides the sheet on lg+, so this is harmless on desktop.
    setSheetSlot(slot)
  }, [])

  const closeSheet = useCallback(() => setSheetSlot(null), [])

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <NavBar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <section className="pb-4 pt-6 sm:pb-5 sm:pt-8">
          <h1 className="text-[24px] font-semibold tracking-tight sm:text-[28px]">
            Markets that close soon.
          </h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Pick a side. The keeper pays out when the answer arrives.
          </p>
        </section>

        <StatStrip network="devnet" />

        {/* Mobile keeps the chip-style filter bar. Hidden on desktop where
            the sidebar takes over. */}
        <div className="lg:hidden">
          <FilterBar
            source={source}
            horizon={horizon}
            onSourceChange={setSource}
            onHorizonChange={setHorizon}
          />
        </div>

        <div className="grid gap-6 py-6 sm:py-8 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
          <CategorySidebar
            source={source}
            horizon={horizon}
            statuses={statuses}
            slots={allSlots}
            onSourceChange={setSource}
            onHorizonChange={setHorizon}
            onStatusToggle={handleStatusToggle}
            className="hidden lg:block lg:sticky lg:top-20 lg:self-start"
          />

          <MarketList
            source={source}
            horizon={horizon}
            statuses={statuses}
            selectedPda={selectedSlot?.marketPda ?? null}
            selectedSide={selectedSide}
            onSelectSide={handleSelectSide}
            onSlotsChange={setAllSlots}
          />

          <BetTicket
            slot={selectedSlot}
            side={selectedSide}
            onSideChange={setSelectedSide}
            className="hidden lg:flex lg:sticky lg:top-20 lg:self-start"
          />
        </div>
      </div>

      {/* Mobile-only bottom sheet. lg:hidden wraps the fixed-positioned
          dialog so it disappears entirely on desktop. */}
      <div className="lg:hidden">
        <BetSheet slot={sheetSlot} onClose={closeSheet} />
      </div>
    </main>
  )
}
