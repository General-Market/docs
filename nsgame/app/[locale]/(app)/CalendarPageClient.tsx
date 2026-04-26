'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { NavBar } from '@/components/markets/NavBar'
import { CategorySidebar, type StatusFilter } from '@/components/markets/CategorySidebar'
import { MarketList } from '@/components/markets/MarketList'
import { BetTicket } from '@/components/markets/BetTicket'
import { BetSheet } from '@/components/markets/BetSheet'
import { MobileMenu } from '@/components/markets/MobileMenu'
import { BottomNav } from '@/components/markets/BottomNav'
import { MarketTeaserSidebar } from '@/components/markets/MarketTeaserSidebar'
import type { BoardFilter } from '@/components/markets/FilterBar'
import type { Side } from '@/components/markets/MarketRow'
import type { UpcomingSlot } from '@/lib/markets/hooks'
import { useWallet } from '@/hooks/useWallet'
import { identify } from '@/lib/analytics/track'
import { activeCluster } from '@/lib/solana/cluster'

// Three columns when a market is picked, two when none. Sidebar holds
// positions, activity, status, boards. The right rail only exists in
// service of the click — without it, the cards fill the space.

export function CalendarPageClient() {
  const [board, setBoard] = useState<BoardFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('live')

  const [selectedSlot, setSelectedSlot] = useState<UpcomingSlot | null>(null)
  const [selectedSide, setSelectedSide] = useState<Side>('yes')
  const [sheetSlot, setSheetSlot] = useState<UpcomingSlot | null>(null)

  const [allSlots, setAllSlots] = useState<UpcomingSlot[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  // Tie product analytics to the wallet pubkey. Identifying once per
  // connection is enough — posthog stores the distinct id in
  // localStorage and re-uses it on subsequent events.
  const { address } = useWallet()
  const lastIdentifiedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!address) return
    if (lastIdentifiedRef.current === address) return
    lastIdentifiedRef.current = address
    identify(address, { cluster: activeCluster, wallet_address: address })
  }, [address])

  // Cohort rotation drags the right rail with it. Without this, the
  // ticket holds a slot whose closeTime has already crept into the past;
  // the program then rejects every bet with "closeTime must be at least
  // 10s in the future". Re-resolve the selected pick to the live cohort
  // by catalogId every time the universe regenerates. If the pair has
  // no live cohort (filtered out by the 10s cushion), drop the pick.
  useEffect(() => {
    const reseat = (prev: UpcomingSlot | null): UpcomingSlot | null => {
      if (!prev) return prev
      const next = allSlots.find(s => s.catalogId === prev.catalogId)
      if (!next) return null
      if (next.marketPda === prev.marketPda) return prev
      return next
    }
    setSelectedSlot(prev => reseat(prev))
    setSheetSlot(prev => reseat(prev))
  }, [allSlots])

  const handleSelectSide = useCallback((slot: UpcomingSlot, side: Side) => {
    setSelectedSlot(slot)
    setSelectedSide(side)
    setSheetSlot(slot)
  }, [])

  // Teaser sidebars share the bet-sheet entry point. Default side is yes —
  // the user picks a competitor inside the sheet.
  const handleTeaserSelect = useCallback((slot: UpcomingSlot) => {
    setSelectedSlot(slot)
    setSelectedSide('yes')
    setSheetSlot(slot)
  }, [])

  const closeSheet = useCallback(() => setSheetSlot(null), [])
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  // Two columns when nothing is picked; three when a market opens the
  // ticket. Unmount the right column entirely so the grid reflows.
  const hasPick = selectedSlot !== null
  const gridCols = hasPick
    ? 'lg:grid-cols-[220px_minmax(0,1fr)_320px]'
    : 'lg:grid-cols-[220px_minmax(0,1fr)]'

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-[calc(env(safe-area-inset-bottom,0)+64px)] lg:pb-0">
      <NavBar onMenuClick={openMenu} />

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        board={board}
        status={status}
        slots={allSlots}
        onBoardChange={setBoard}
        onStatusChange={setStatus}
      />

      <div className="xl:flex xl:items-start xl:justify-center xl:gap-6 xl:px-4 xl:py-8">
        <MarketTeaserSidebar
          slots={allSlots}
          side="left"
          onSelect={handleTeaserSelect}
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 xl:mx-0 xl:px-0">
          <div className={['grid gap-6 py-6 sm:py-8 xl:py-0', gridCols].join(' ')}>
            <CategorySidebar
              board={board}
              status={status}
              slots={allSlots}
              onBoardChange={setBoard}
              onStatusChange={setStatus}
              className="hidden lg:block lg:sticky lg:top-20 lg:self-start"
            />

            <MarketList
              board={board}
              status={status}
              selectedPda={selectedSlot?.marketPda ?? null}
              selectedSide={selectedSide}
              onSelectSide={handleSelectSide}
              onSlotsChange={setAllSlots}
            />

            {hasPick ? (
              <BetTicket
                slot={selectedSlot}
                side={selectedSide}
                onSideChange={setSelectedSide}
                className="hidden lg:flex lg:sticky lg:top-20 lg:self-start"
              />
            ) : null}
          </div>
        </div>

        <MarketTeaserSidebar
          slots={allSlots}
          side="right"
          onSelect={handleTeaserSelect}
        />
      </div>

      {/* Mobile bottom sheet for the bet ticket */}
      <div className="lg:hidden">
        <BetSheet slot={sheetSlot} onClose={closeSheet} />
      </div>

      {/* Mobile fixed bottom nav */}
      <BottomNav
        onMenuClick={openMenu}
        hasTicket={!!selectedSlot}
      />
    </main>
  )
}
