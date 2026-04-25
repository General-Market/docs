'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { NavBar } from '@/components/markets/NavBar'
import { CategorySidebar, type StatusFilter } from '@/components/markets/CategorySidebar'
import { MarketList } from '@/components/markets/MarketList'
import { BetTicket } from '@/components/markets/BetTicket'
import { BetSheet } from '@/components/markets/BetSheet'
import { MobileMenu } from '@/components/markets/MobileMenu'
import { BottomNav } from '@/components/markets/BottomNav'
import type { BoardFilter, HorizonFilter } from '@/components/markets/FilterBar'
import type { Side } from '@/components/markets/MarketRow'
import type { UpcomingSlot } from '@/lib/markets/hooks'
import { useWallet } from '@/hooks/useWallet'
import { identify } from '@/lib/analytics/track'
import { activeCluster } from '@/lib/solana/cluster'

// Three columns on desktop. Sidebar, list, ticket. The world is two
// boards now — stars and cams — so the top bar drops the source tabs and
// lets the sidebar do the cutting.

export function CalendarPageClient() {
  const [board, setBoard] = useState<BoardFilter>('all')
  const [horizon, setHorizon] = useState<HorizonFilter>('7d')
  const [statuses, setStatuses] = useState<StatusFilter[]>([])

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

  const handleStatusToggle = useCallback((s: StatusFilter) => {
    setStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s],
    )
  }, [])

  const handleSelectSide = useCallback((slot: UpcomingSlot, side: Side) => {
    setSelectedSlot(slot)
    setSelectedSide(side)
    setSheetSlot(slot)
  }, [])

  const closeSheet = useCallback(() => setSheetSlot(null), [])
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-[calc(env(safe-area-inset-bottom,0)+64px)] lg:pb-0">
      <NavBar onMenuClick={openMenu} />

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        board={board}
        horizon={horizon}
        statuses={statuses}
        slots={allSlots}
        onBoardChange={setBoard}
        onHorizonChange={setHorizon}
        onStatusToggle={handleStatusToggle}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 py-6 sm:py-8 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
          <CategorySidebar
            board={board}
            horizon={horizon}
            statuses={statuses}
            slots={allSlots}
            onBoardChange={setBoard}
            onHorizonChange={setHorizon}
            onStatusToggle={handleStatusToggle}
            className="hidden lg:block lg:sticky lg:top-20 lg:self-start"
          />

          <MarketList
            board={board}
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
