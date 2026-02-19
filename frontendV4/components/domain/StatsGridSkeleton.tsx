'use client'

import { Skeleton } from '@/components/ui/Skeleton'

/**
 * StatsGridSkeleton component (Story 11-1, AC3)
 * Matches exact structure of stats grid on agent detail page
 *
 * - 6-card grid layout (2x3 on desktop, 2x2 on mobile)
 * - Consistent with StatCard component
 * - No layout shift when data loads
 */
export function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-terminal border border-white/20 p-4">
          <Skeleton width={100} height={14} className="mb-2" />
          <Skeleton width={80} height={28} />
        </div>
      ))}
    </div>
  )
}

/**
 * AgentDetailSkeleton - Full agent detail page skeleton
 */
export function AgentDetailSkeleton() {
  return (
    <main className="min-h-screen bg-terminal">
      {/* Header skeleton */}
      <header className="flex justify-between items-center p-6 border-b border-white/10">
        <Skeleton width={160} height={20} />
        <Skeleton width={100} height={16} />
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* Agent header skeleton */}
        <div className="flex flex-col md:flex-row md:items-start gap-4 mb-8">
          <div className="flex items-center gap-4 flex-1">
            <Skeleton width={48} height={48} rounded={false} className="rounded-full" />
            <div className="flex-1">
              <Skeleton width={200} height={16} className="mb-2" />
              <Skeleton width={120} height={24} />
            </div>
          </div>
          <div className="text-right">
            <Skeleton width={60} height={14} className="mb-2" />
            <Skeleton width={100} height={36} />
          </div>
        </div>

        {/* Portfolio Statistics Section */}
        <div className="mb-8">
          <Skeleton width={180} height={24} className="mb-4" />
          <StatsGridSkeleton />
        </div>

        {/* Performance Metrics Section */}
        <div className="mb-8">
          <Skeleton width={180} height={24} className="mb-4" />
          <StatsGridSkeleton />
        </div>

        {/* Performance Graph Section */}
        <div className="border border-white/20 bg-terminal mb-8">
          <div className="flex justify-between items-center p-4 border-b border-white/20">
            <Skeleton width={160} height={24} />
            <Skeleton width={200} height={32} />
          </div>
          <div className="p-4">
            <Skeleton width="100%" height={400} />
          </div>
        </div>

        {/* Recent Portfolio Bets Section */}
        <div className="border border-white/20 bg-terminal mb-8">
          <div className="flex justify-between items-center p-4 border-b border-white/20">
            <Skeleton width={180} height={24} />
            <Skeleton width={60} height={20} />
          </div>
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton width={80} height={16} />
                <Skeleton width={120} height={16} />
                <Skeleton width={60} height={16} />
                <Skeleton width={60} height={16} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
