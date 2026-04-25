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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3">
      <span className="flex min-w-0 flex-col gap-2">
        <Bar w={42} h={10} />
        <Bar w={62} h={22} />
      </span>
      <span className="flex flex-col items-end gap-1.5">
        <Bar w={36} h={9} />
        <Bar w={44} h={13} />
      </span>
    </div>
  )
}

export function MarketRowSkeleton() {
  return (
    <article
      className="rounded-xl border border-zinc-800 bg-[linear-gradient(180deg,rgb(24,24,27)_0%,rgb(20,20,23)_100%)] p-5"
      aria-hidden="true"
    >
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Bar w={16} h={16} className="rounded-full" />
          <Bar w={70} h={12} />
          <Bar w={48} h={11} />
        </span>
        <span className="flex items-center gap-1.5">
          <Bar w={48} h={11} />
          <Bar w={56} h={11} />
        </span>
      </header>

      <div className="mt-3 flex flex-col gap-2">
        <Bar w="75%" h={16} />
        <Bar w="50%" h={16} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <OutcomeButtonSkeleton />
        <OutcomeButtonSkeleton />
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3">
        <Bar w={88} h={12} />
        <Bar w={132} h={12} />
      </footer>
    </article>
  )
}
