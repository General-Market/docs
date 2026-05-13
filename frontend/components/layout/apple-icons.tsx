import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function HomeIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9" />
    </svg>
  )
}

export function LayersIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </svg>
  )
}

export function BoxesIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  )
}

export function VaultIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5V7M12 17v-1.5M8.5 12H7M17 12h-1.5" />
    </svg>
  )
}

export function CompassIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </svg>
  )
}

export function TrophyIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M8 4h8v5a4 4 0 11-8 0V4z" />
      <path d="M16 5h3v3a3 3 0 01-3 3M8 5H5v3a3 3 0 003 3" />
      <path d="M10 14h4M9 18h6M12 14v4" />
    </svg>
  )
}

export function BotIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <path d="M12 4v3" />
      <circle cx="9" cy="13" r="0.6" fill="currentColor" />
      <circle cx="15" cy="13" r="0.6" fill="currentColor" />
      <path d="M9 17h6" />
    </svg>
  )
}

export function UserIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  )
}

export function PulseIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M3 12h4l2-6 4 12 2-8 2 4 4-2" />
    </svg>
  )
}

export function ArrowLeftIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M14 6l-6 6 6 6" />
      <path d="M8 12h12" />
    </svg>
  )
}
