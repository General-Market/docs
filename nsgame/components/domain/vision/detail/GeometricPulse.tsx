'use client'

import { useMemo, useRef, useEffect } from 'react'

interface GeometricPulseProps {
  brandBg: string
  /** Seconds remaining in current tick, controls pulse speed */
  tickRemaining?: number
  /** Total tick duration in seconds */
  tickDuration?: number
}

const RING_COUNT = 6

/**
 * Detect whether a CSS background value is perceptually light.
 * Works for hex colors; assumes dark for gradients and other values.
 */
function isLightBg(bg: string): boolean {
  const hex = bg.match(/^#([0-9a-f]{3,8})$/i)?.[1]
  if (!hex) return false
  const full =
    hex.length === 3
      ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      : hex.slice(0, 6)
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
}

/**
 * Compute animation cycle duration based on how close the tick is to firing.
 * Normal: 8s cycle. Last 60s: 4s. Last 15s: 2s.
 */
function getCycleDuration(remaining: number | undefined): number {
  if (remaining === undefined) return 8
  if (remaining > 60) return 8
  if (remaining > 15) return 4
  return 2
}

export function GeometricPulse({ brandBg, tickRemaining }: GeometricPulseProps) {
  const isLight = useMemo(() => isLightBg(brandBg), [brandBg])
  const ringColor = isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.18)'
  const cycleDuration = getCycleDuration(tickRemaining)

  // Ref to update animation-duration without re-mounting SVG
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const circles = svg.querySelectorAll('circle')
    circles.forEach((c, i) => {
      c.style.animationDuration = `${cycleDuration}s`
      c.style.animationDelay = `${(i * cycleDuration) / RING_COUNT}s`
    })
  }, [cycleDuration])

  return (
    <div className="absolute inset-0 overflow-hidden geo-pulse-container" aria-hidden="true">
      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: '300%', height: '300%' }}
      >
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <circle
            key={i}
            cx="100"
            cy="100"
            r="70"
            fill="none"
            stroke={ringColor}
            strokeWidth="1.5"
            style={{
              transformOrigin: '100px 100px',
              animation: `geo-pulse-ring ${cycleDuration}s ease-out infinite`,
              animationDelay: `${(i * cycleDuration) / RING_COUNT}s`,
            }}
          />
        ))}
      </svg>
    </div>
  )
}
