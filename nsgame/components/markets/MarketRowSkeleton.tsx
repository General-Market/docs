'use client'

import { Skeleton } from '@/components/ui/Skeleton'

// Static skeleton mirroring MarketRow. Same outer geometry, same inner
// rhythm — header → title → two outcome buttons → footer. The shimmer
// rides the tailwind `animate-shimmer` keyframe at 1.5s.

function OutcomeButtonSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton variant="shimmer" width={42} height={10} />
        <Skeleton variant="shimmer" width={56} height={22} />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton variant="shimmer" width={36} height={9} />
        <Skeleton variant="shimmer" width={44} height={13} />
      </div>
    </div>
  )
}

export function MarketRowSkeleton() {
  return (
    <article
      className="rounded-xl border border-zinc-200/80 bg-white p-5"
      aria-hidden="true"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton variant="shimmer" width={16} height={16} className="rounded-full" />
          <Skeleton variant="shimmer" width={70} height={12} />
          <Skeleton variant="shimmer" width={48} height={11} />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton variant="shimmer" width={48} height={11} />
          <Skeleton variant="shimmer" width={56} height={11} />
        </div>
      </header>

      <div className="mt-3 flex flex-col gap-2">
        <Skeleton variant="shimmer" height={16} className="w-3/4" />
        <Skeleton variant="shimmer" height={16} className="w-1/2" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <OutcomeButtonSkeleton />
        <OutcomeButtonSkeleton />
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3">
        <Skeleton variant="shimmer" width={80} height={12} />
        <Skeleton variant="shimmer" width={120} height={12} />
      </footer>
    </article>
  )
}
