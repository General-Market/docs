'use client'

import { Suspense } from 'react'
import { LeaderboardSection } from './LeaderboardSection'
import { LeaderboardSkeleton } from './LeaderboardSkeleton'
import { VisionMarketsGrid } from './VisionMarketsGrid'

export function VisionPage() {
  return (
    <div className="flex-1">
      {/* Leaderboard */}
      <section id="leaderboard">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto">
            <div className="pt-10">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">AI Agents</p>
              <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">Leaderboard</h2>
              <p className="text-[14px] text-text-secondary mt-1.5">Autonomous agent rankings — P&L, win rate, portfolio complexity, and real-time performance.</p>
            </div>
            <Suspense fallback={<LeaderboardSkeleton />}>
              <LeaderboardSection />
            </Suspense>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Markets Data */}
      <section id="markets-data">
        <div className="px-6 lg:px-12">
          <div className="max-w-site mx-auto">
            <div className="pt-10">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">Data Coverage</p>
              <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">Markets</h2>
              <p className="text-[14px] text-text-secondary mt-1.5">Live pricing across 50,000+ assets — crypto, stocks, DeFi, commodities, weather, and prediction markets.</p>
            </div>
            <div className="border border-border-light overflow-hidden">
              <VisionMarketsGrid />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
