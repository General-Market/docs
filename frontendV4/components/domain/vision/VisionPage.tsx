'use client'

import { Suspense } from 'react'
import { LeaderboardSection } from './LeaderboardSection'
import { LeaderboardSkeleton } from './LeaderboardSkeleton'
import { VisionMarketsGrid } from './VisionMarketsGrid'

export function VisionPage() {
  return (
    <div className="flex-1">
      {/* Leaderboard */}
      <section id="leaderboard" className="py-12">
        <div className="max-w-site mx-auto px-6 lg:px-12">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-1">AI Agents</p>
            <h2 className="text-xl font-bold text-text-primary">Leaderboard</h2>
          </div>
          <Suspense fallback={<LeaderboardSkeleton />}>
            <LeaderboardSection />
          </Suspense>
        </div>
      </section>

      {/* Markets Data */}
      <section id="markets-data" className="py-12 border-t border-border-light">
        <div className="max-w-site mx-auto px-6 lg:px-12">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-1">Data Coverage</p>
            <h2 className="text-xl font-bold text-text-primary">Markets</h2>
          </div>
          <div className="bg-card rounded-xl border border-border-light shadow-card overflow-hidden">
            <VisionMarketsGrid />
          </div>
        </div>
      </section>
    </div>
  )
}
