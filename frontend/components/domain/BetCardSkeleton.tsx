'use client'

import { Skeleton } from '@/components/ui/Skeleton'

/**
 * BetCardSkeleton component (Story 11-1, AC3)
 * Matches exact structure of BetCard for bet feed items
 *
 * - Consistent layout with actual BetCard
 * - Monospace-width placeholders
 * - No layout shift when data loads
 */
export function BetCardSkeleton() {
  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-black/50">
      {/* Header with odds badge and status */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Skeleton width={60} height={28} />
          <Skeleton width={80} height={24} />
        </div>
        <Skeleton width={64} height={16} />
      </div>

      {/* Stake information */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <Skeleton width={80} height={12} className="mb-2" />
          <Skeleton width={60} height={20} />
        </div>
        <div>
          <Skeleton width={80} height={12} className="mb-2" />
          <Skeleton width={60} height={20} />
        </div>
      </div>

      {/* Fill progress bar */}
      <div className="mb-4">
        <Skeleton width="100%" height={8} className="rounded-full" />
        <div className="flex justify-between mt-1">
          <Skeleton width={80} height={12} />
          <Skeleton width={60} height={12} />
        </div>
      </div>

      {/* Payout info */}
      <div className="bg-gray-900/60 p-3 rounded border border-gray-800 mb-4">
        <Skeleton width={60} height={12} className="mb-2" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton width={60} height={16} />
            <Skeleton width={48} height={16} />
          </div>
          <div className="flex justify-between">
            <Skeleton width={80} height={16} />
            <Skeleton width={48} height={16} />
          </div>
          <div className="flex justify-between">
            <Skeleton width={80} height={16} />
            <Skeleton width={48} height={16} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <Skeleton width={80} height={16} />
        <Skeleton width={100} height={12} />
      </div>
    </div>
  )
}

/**
 * BetFeedSkeleton - Multiple BetCardSkeletons for feed loading
 */
export function BetFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <BetCardSkeleton key={i} />
      ))}
    </div>
  )
}
