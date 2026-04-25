'use client'

// A small dot. When active, it rings. When idle, it merely is.
// Used for the network indicator in NavBar and the live-tick mark
// elsewhere. Always a dot — the halo is the only thing that moves.

interface PulseDotProps {
  active: boolean
  color?: 'emerald' | 'rose' | 'amber'
  size?: number
  className?: string
}

const COLOR_BG: Record<NonNullable<PulseDotProps['color']>, string> = {
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-400',
}

export function PulseDot({
  active,
  color = 'amber',
  size = 6,
  className = '',
}: PulseDotProps) {
  const bg = COLOR_BG[color]
  const dim = `${size}px`

  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      {active ? (
        <span
          className={`absolute inset-0 inline-flex animate-ping rounded-full ${bg} opacity-60`}
        />
      ) : null}
      <span
        className={`relative inline-flex rounded-full ${bg}`}
        style={{ width: dim, height: dim }}
      />
    </span>
  )
}
