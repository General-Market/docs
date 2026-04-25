'use client'

import { useState } from 'react'
import { NavBar } from '@/components/markets/NavBar'
import { FilterBar, type SourceFilter, type HorizonFilter } from '@/components/markets/FilterBar'
import { MarketCalendar } from '@/components/markets/MarketCalendar'

// The home page. A nav. A filter row. A calendar of markets. Anything more
// would be ornament.

export function CalendarPageClient() {
  const [source, setSource] = useState<SourceFilter>('all')
  const [horizon, setHorizon] = useState<HorizonFilter>('7d')

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-6 sm:py-8">
          <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
            Markets that close soon.
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Pick a side. The keeper pays out when the answer arrives.
          </p>
        </section>

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
