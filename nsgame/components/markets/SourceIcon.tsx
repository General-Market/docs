'use client'

// Abstract geometric marks for tube sources. Not logos — these are
// unprotectable shapes. currentColor everywhere so the parent decides
// the hue and tone.

interface SourceIconProps {
  sourceId: 1 | 2 | 3 | 4 | 5
  className?: string
}

export function SourceIcon({ sourceId, className = '' }: SourceIconProps) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    className,
    'aria-hidden': true as const,
    fill: 'currentColor',
  }

  switch (sourceId) {
    case 1:
      // Upward triangle — xv
      return (
        <svg {...common}>
          <polygon points="8,3 14,13 2,13" />
        </svg>
      )
    case 2:
      // Downward triangle — xn
      return (
        <svg {...common}>
          <polygon points="2,3 14,3 8,13" />
        </svg>
      )
    case 3:
      // Hollow circle — ph
      return (
        <svg {...common} fill="none">
          <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 4:
      // Filled square — cb
      return (
        <svg {...common}>
          <rect x="3" y="3" width="10" height="10" />
        </svg>
      )
    case 5:
      // Diamond — ep
      return (
        <svg {...common}>
          <polygon points="8,2 14,8 8,14 2,8" />
        </svg>
      )
    default:
      return null
  }
}
