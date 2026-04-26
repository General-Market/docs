'use client'

// Static skeleton mirroring MarketRow geometry — header, two-line title,
// two outcome buttons, footer. A gradient sweep rides the surface every
// 1.5s. Dark surface, hairline border. The page admits it does not yet
// know what it will be.

function Bar({ w, h, className = '' }: { w: number | string; h: number | string; className?: string }) {
  return (
    <span
      className={[
        'relative inline-block overflow-hidden rounded-md bg-zinc-800/60',
        className,
      ].join(' ')}
      style={{ width: typeof w === 'number' ? `${w}px` : w, height: typeof h === 'number' ? `${h}px` : h }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-zinc-700/60 to-transparent"
        style={{ animationDuration: '1.6s' }}
      />
    </span>
  )
}

function OutcomeButtonSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-2">
      <span className="flex items-center gap-3">
        <Bar w={36} h={36} className="rounded-md" />
        <span className="flex flex-col gap-1.5">
          <Bar w={90} h={12} />
          <Bar w={140} h={2} />
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Bar w={40} h={28} className="rounded-md" />
        <Bar w={60} h={28} className="rounded-full" />
      </span>
    </div>
  )
}

export function MarketRowSkeleton() {
  return (
    <article
      className="rounded-xl border border-zinc-800 bg-[linear-gradient(180deg,rgb(24,24,27)_0%,rgb(20,20,23)_100%)] p-3 pl-4 sm:p-4 sm:pl-5"
      aria-hidden="true"
    >
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Bar w={24} h={24} className="rounded-md" />
          <Bar w={70} h={11} />
        </span>
        <Bar w={70} h={11} />
      </header>

      <div className="mt-2">
        <Bar w="65%" h={16} />
      </div>

      <div className="mt-1.5">
        <Bar w={120} h={11} />
      </div>

      <div className="mt-1.5 flex flex-col">
        <OutcomeButtonSkeleton />
        <OutcomeButtonSkeleton />
      </div>

      <footer className="mt-2 flex items-center justify-between gap-3 pt-2">
        <Bar w={70} h={11} />
        <Bar w={80} h={11} />
      </footer>
    </article>
  )
}
