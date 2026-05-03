import type { SVGProps } from 'react'

type LogoProps = SVGProps<SVGSVGElement> & { className?: string; height?: number }

/**
 * NYSE wordmark — italic bold sans-serif "NYSE" in NYSE blue, with the
 * recognizable horizontal accent bar above. Single inline SVG, no asset request.
 */
export function NyseLogo({ height = 28, className, ...rest }: LogoProps) {
  return (
    <svg
      viewBox="0 0 220 60"
      height={height}
      role="img"
      aria-label="NYSE"
      className={className}
      {...rest}
    >
      <rect x="0" y="6" width="220" height="6" fill="#00549C" />
      <text
        x="0"
        y="50"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="44"
        letterSpacing="1"
        fill="#00549C"
      >
        NYSE
      </text>
    </svg>
  )
}
