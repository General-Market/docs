'use client'

import { useState } from 'react'
import { NavBar } from '@/components/markets/NavBar'
import { FilterBar, type SourceFilter, type HorizonFilter } from '@/components/markets/FilterBar'
import { MarketCalendar } from '@/components/markets/MarketCalendar'
import { StatStrip } from '@/components/markets/StatStrip'

// The home page. A nav. A stat strip. A filter row. A calendar of markets.
// Anything more would be ornament.

export function CalendarPageClient() {
  const [source, setSource] = useState<SourceFilter>('all')
  const [horizon, setHorizon] = useState<HorizonFilter>('7d')

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

        <FilterBar
          source={source}
          horizon={horizon}
          onSourceChange={setSource}
          onHorizonChange={setHorizon}
        />

        <section className="py-6 sm:py-8">
          <MarketCalendar source={source} horizon={horizon} />
        </section>
      </div>
    </main>
  )
}
